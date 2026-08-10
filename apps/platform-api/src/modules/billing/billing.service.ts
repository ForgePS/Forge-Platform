import { createHmac, timingSafeEqual } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import {
  createBillingContractInputSchema,
  createBillingCustomerInputSchema,
  createBillingFeeInputSchema,
  billingWebhookEnvelopeSchema,
  toOperationalSubscriptionStatus,
  BILLING_WEBHOOK_ENTITLEMENT_INVARIANT,
  type BillingProviderCode,
} from "@forge/contracts";
import {
  billingContracts,
  billingCustomers,
  billingFeeLines,
  billingInvoices,
  billingOrders,
  billingOrderItems,
  billingProviderEvents,
  createId,
  type Database,
  withTenantTransaction,
} from "@forge/database";
import { ForgeError } from "@forge/errors";
import { DOMAIN_EVENT_TYPES } from "@forge/events";
import type { ForgePrincipal } from "@forge/tenant-context";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { DATABASE } from "../../tokens.js";
import { AuditService } from "../audit/audit.service.js";
import { EntitlementsService } from "../entitlements/entitlements.service.js";
import { OutboxService } from "../outbox/outbox.service.js";
import { SubscriptionsService } from "../subscriptions/subscriptions.service.js";

const invoiceMetadataSchema = z.object({
  status: z.enum(["DRAFT", "OPEN", "PAID", "VOID", "UNCOLLECTIBLE"]).default("OPEN"),
  currency: z.string().length(3).default("USD"),
  amountDueCents: z.number().int().nonnegative().default(0),
  amountPaidCents: z.number().int().nonnegative().default(0),
  externalInvoiceId: z.string().max(255).optional().nullable(),
  hostedInvoiceUrl: z.string().url().max(2000).optional().nullable(),
  subscriptionId: z.string().uuid().optional().nullable(),
  orderId: z.string().uuid().optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
});

const orderSchema = z.object({
  status: z.enum(["DRAFT", "OPEN", "FULFILLED", "CANCELED"]).default("OPEN"),
  currency: z.string().length(3).default("USD"),
  contractId: z.string().uuid().optional().nullable(),
  items: z
    .array(
      z.object({
        description: z.string().min(1).max(500),
        quantity: z.number().int().positive().default(1),
        unitAmountCents: z.number().int().nonnegative().default(0),
        billingType: z.string().max(64).default("ONE_TIME"),
      }),
    )
    .min(1)
    .max(50),
});

export function verifyBillingWebhookSignature(
  rawBody: string,
  signatureHeader: string | undefined,
  secret: string,
): boolean {
  if (!signatureHeader || !secret) return false;
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const provided = signatureHeader.replace(/^sha256=/i, "").trim();
  try {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(provided, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

@Injectable()
export class BillingService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
    private readonly entitlements: EntitlementsService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  entitlementInvariant(): string {
    return BILLING_WEBHOOK_ENTITLEMENT_INVARIANT;
  }

  async ensureCustomer(tenantId: string, input: unknown, principal: ForgePrincipal) {
    const data = createBillingCustomerInputSchema.parse(input ?? {});
    return withTenantTransaction(this.db, tenantId, async (tx) => {
      const existing = await tx.query.billingCustomers.findFirst({
        where: eq(billingCustomers.tenantId, tenantId),
      });
      if (existing) {
        return existing;
      }
      const now = new Date();
      const id = createId();
      const [row] = await tx
        .insert(billingCustomers)
        .values({
          id,
          tenantId,
          displayName: data.displayName ?? `Tenant ${tenantId.slice(0, 8)}`,
          billingEmail: data.billingEmail ?? null,
          billingProvider: data.billingProvider,
          externalCustomerId: data.externalCustomerId ?? null,
          status: "ACTIVE",
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      if (!row) {
        throw new ForgeError("INTERNAL_ERROR", "Failed to create billing customer");
      }
      await this.audit.writeInTransaction(tx, {
        tenantId,
        actorUserId: principal.userId,
        actorPersonId: principal.personId,
        actorType: "USER",
        action: "billing.customer.create",
        resourceType: "billing_customer",
        resourceId: id,
        result: "SUCCESS",
        riskLevel: "MEDIUM",
        correlationId: principal.correlationId,
        requestId: principal.requestId,
        after: row,
      });
      return row;
    }, principal.userId);
  }

  async createContract(tenantId: string, input: unknown, principal: ForgePrincipal) {
    const data = createBillingContractInputSchema.parse(input);
    const customer = await this.ensureCustomer(tenantId, {}, principal);
    return withTenantTransaction(this.db, tenantId, async (tx) => {
      const now = new Date();
      const id = createId();
      const [row] = await tx
        .insert(billingContracts)
        .values({
          id,
          tenantId,
          billingCustomerId: customer.id,
          name: data.name,
          status: data.status,
          billingType: data.billingType,
          startsOn: data.startsOn ?? null,
          endsOn: data.endsOn ?? null,
          renewalOn: data.renewalOn ?? null,
          setupFeeCents: data.setupFeeCents ?? null,
          notes: data.notes ?? null,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      if (!row) {
        throw new ForgeError("INTERNAL_ERROR", "Failed to create billing contract");
      }
      await this.outbox.write(tx, {
        tenantId,
        aggregateType: "billing_contract",
        aggregateId: id,
        eventType: DOMAIN_EVENT_TYPES.BILLING_CONTRACT_CHANGED,
        payload: { contractId: id, status: data.status, billingType: data.billingType },
        correlationId: principal.correlationId,
        actorUserId: principal.userId,
      });
      await this.audit.writeInTransaction(tx, {
        tenantId,
        actorUserId: principal.userId,
        actorPersonId: principal.personId,
        actorType: "USER",
        action: "billing.contract.create",
        resourceType: "billing_contract",
        resourceId: id,
        result: "SUCCESS",
        riskLevel: "HIGH",
        correlationId: principal.correlationId,
        requestId: principal.requestId,
        after: row,
      });
      return row;
    }, principal.userId);
  }

  async addFeeLine(tenantId: string, input: unknown, principal: ForgePrincipal) {
    const data = createBillingFeeInputSchema.parse(input);
    return withTenantTransaction(this.db, tenantId, async (tx) => {
      const id = createId();
      const [row] = await tx
        .insert(billingFeeLines)
        .values({
          id,
          tenantId,
          contractId: data.contractId ?? null,
          orderId: data.orderId ?? null,
          feeType: data.feeType,
          amountCents: data.amountCents,
          currency: data.currency,
          description: data.description ?? null,
          createdAt: new Date(),
        })
        .returning();
      if (!row) {
        throw new ForgeError("INTERNAL_ERROR", "Failed to create fee line");
      }
      await this.audit.writeInTransaction(tx, {
        tenantId,
        actorUserId: principal.userId,
        actorPersonId: principal.personId,
        actorType: "USER",
        action: "billing.fee.create",
        resourceType: "billing_fee_line",
        resourceId: id,
        result: "SUCCESS",
        riskLevel: "MEDIUM",
        correlationId: principal.correlationId,
        requestId: principal.requestId,
        after: row,
      });
      return row;
    }, principal.userId);
  }

  async createOrder(tenantId: string, input: unknown, principal: ForgePrincipal) {
    const data = orderSchema.parse(input);
    const customer = await this.ensureCustomer(tenantId, {}, principal);
    const total = data.items.reduce(
      (sum, item) => sum + item.quantity * item.unitAmountCents,
      0,
    );
    return withTenantTransaction(this.db, tenantId, async (tx) => {
      const now = new Date();
      const orderId = createId();
      const [order] = await tx
        .insert(billingOrders)
        .values({
          id: orderId,
          tenantId,
          billingCustomerId: customer.id,
          contractId: data.contractId ?? null,
          status: data.status,
          currency: data.currency,
          totalCents: total,
          metadataJson: {},
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      if (!order) {
        throw new ForgeError("INTERNAL_ERROR", "Failed to create order");
      }
      for (const item of data.items) {
        await tx.insert(billingOrderItems).values({
          id: createId(),
          tenantId,
          orderId,
          description: item.description,
          quantity: item.quantity,
          unitAmountCents: item.unitAmountCents,
          billingType: item.billingType,
          metadataJson: {},
          createdAt: now,
        });
      }
      return order;
    }, principal.userId);
  }

  async recordInvoiceMetadata(tenantId: string, input: unknown, principal: ForgePrincipal) {
    const data = invoiceMetadataSchema.parse(input);
    const customer = await this.ensureCustomer(tenantId, {}, principal);
    return withTenantTransaction(this.db, tenantId, async (tx) => {
      const now = new Date();
      const id = createId();
      const [row] = await tx
        .insert(billingInvoices)
        .values({
          id,
          tenantId,
          billingCustomerId: customer.id,
          subscriptionId: data.subscriptionId ?? null,
          orderId: data.orderId ?? null,
          status: data.status,
          currency: data.currency,
          amountDueCents: data.amountDueCents,
          amountPaidCents: data.amountPaidCents,
          externalInvoiceId: data.externalInvoiceId ?? null,
          hostedInvoiceUrl: data.hostedInvoiceUrl ?? null,
          metadataJson: data.metadata ?? {},
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      if (!row) {
        throw new ForgeError("INTERNAL_ERROR", "Failed to record invoice metadata");
      }
      return row;
    }, principal.userId);
  }

  async listContracts(tenantId: string) {
    return withTenantTransaction(this.db, tenantId, async (tx) =>
      tx.query.billingContracts.findMany({
        where: eq(billingContracts.tenantId, tenantId),
      }),
    );
  }

  /**
   * Ingest provider webhook (STUB/NONE capable). Signature must verify.
   * Entitlement changes go only through EntitlementsService.
   */
  async ingestProviderEvent(input: {
    provider: BillingProviderCode;
    rawBody: string;
    signatureHeader?: string;
    secret: string;
    body: unknown;
    principal: ForgePrincipal;
  }) {
    const signatureValid = verifyBillingWebhookSignature(
      input.rawBody,
      input.signatureHeader,
      input.secret,
    );
    if (!signatureValid) {
      throw new ForgeError("UNAUTHORIZED", "Invalid billing webhook signature");
    }

    const envelope = billingWebhookEnvelopeSchema.parse(input.body);
    if (!envelope.tenantId) {
      throw new ForgeError("BAD_REQUEST", "Webhook envelope requires tenantId");
    }
    const tenantId = envelope.tenantId;
    const now = new Date();

    const receipt = await withTenantTransaction(this.db, tenantId, async (tx) => {
      const existing = await tx.query.billingProviderEvents.findFirst({
        where: and(
          eq(billingProviderEvents.provider, input.provider),
          eq(billingProviderEvents.externalEventId, envelope.eventId),
        ),
      });
      if (existing) {
        return { duplicate: true as const, row: existing };
      }
      const id = createId();
      const [row] = await tx
        .insert(billingProviderEvents)
        .values({
          id,
          tenantId,
          provider: input.provider,
          externalEventId: envelope.eventId,
          eventType: envelope.eventType,
          status: "RECEIVED",
          signatureValid: true,
          payloadJson: envelope,
          receivedAt: now,
          createdAt: now,
        })
        .returning();
      if (!row) {
        throw new ForgeError("INTERNAL_ERROR", "Failed to record provider event");
      }
      await this.outbox.write(tx, {
        tenantId,
        aggregateType: "billing_provider_event",
        aggregateId: id,
        eventType: DOMAIN_EVENT_TYPES.BILLING_PROVIDER_EVENT_RECEIVED,
        payload: { provider: input.provider, externalEventId: envelope.eventId, eventType: envelope.eventType },
        correlationId: input.principal.correlationId,
        actorUserId: input.principal.userId,
      });
      return { duplicate: false as const, row };
    }, input.principal.userId);

    if (receipt.duplicate) {
      return {
        duplicate: true,
        event: receipt.row,
        applied: false,
        invariant: BILLING_WEBHOOK_ENTITLEMENT_INVARIANT,
      };
    }

    try {
      const applied = await this.applyProviderEvent(envelope, input.principal);
      await withTenantTransaction(this.db, tenantId, async (tx) => {
        await tx
          .update(billingProviderEvents)
          .set({ status: "PROCESSED", processedAt: new Date(), processingError: null })
          .where(eq(billingProviderEvents.id, receipt.row.id));
      }, input.principal.userId);
      return {
        duplicate: false,
        event: { ...receipt.row, status: "PROCESSED" },
        applied,
        invariant: BILLING_WEBHOOK_ENTITLEMENT_INVARIANT,
      };
    } catch (err) {
      const processingError = err instanceof Error ? err.message : "Processing failed";
      await withTenantTransaction(this.db, tenantId, async (tx) => {
        await tx
          .update(billingProviderEvents)
          .set({ status: "FAILED", processedAt: new Date(), processingError })
          .where(eq(billingProviderEvents.id, receipt.row.id));
      }, input.principal.userId);
      throw err;
    }
  }

  /**
   * Apply mapped provider events. Product/module unlocks MUST use EntitlementsService.
   */
  async applyProviderEvent(
    envelope: z.infer<typeof billingWebhookEnvelopeSchema>,
    principal: ForgePrincipal,
  ): Promise<boolean> {
    const tenantId = envelope.tenantId;
    if (!tenantId) {
      return false;
    }

    if (
      envelope.eventType === "subscription.activated" ||
      envelope.eventType === "subscription.updated"
    ) {
      const statusRaw =
        typeof envelope.payload.status === "string" ? envelope.payload.status : "ACTIVE";
      const operational = toOperationalSubscriptionStatus(statusRaw) ?? "ACTIVE";
      const list = await this.subscriptions.list(tenantId);
      const match =
        (envelope.externalSubscriptionId
          ? list.find((s) => s.externalSubscriptionId === envelope.externalSubscriptionId)
          : undefined) ?? list[0];
      if (match) {
        await this.subscriptions.patch(
          tenantId,
          match.id,
          {
            status: operational,
            ...(envelope.externalSubscriptionId
              ? { externalSubscriptionId: envelope.externalSubscriptionId }
              : {}),
          },
          principal,
          "*",
        );
      }
    }

    if (envelope.eventType === "entitlement.sync_requested") {
      const productCode =
        typeof envelope.payload.productCode === "string" ? envelope.payload.productCode : null;
      const moduleCode =
        typeof envelope.payload.moduleCode === "string" ? envelope.payload.moduleCode : null;
      if (productCode) {
        await this.entitlements.putProduct(
          tenantId,
          productCode,
          { status: "ACTIVE", configuration: { source: "billing_webhook" } },
          principal,
        );
      }
      if (moduleCode) {
        await this.entitlements.putModule(
          tenantId,
          moduleCode,
          {
            status: "ACTIVE",
            sourceType: "SUBSCRIPTION",
            configuration: { source: "billing_webhook" },
          },
          principal,
        );
      }
      return Boolean(productCode || moduleCode);
    }

    return true;
  }
}
