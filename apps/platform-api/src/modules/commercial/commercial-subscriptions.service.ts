import { Inject, Injectable } from "@nestjs/common";
import {
  ACCESS_POLICIES,
  BILLING_FREQUENCIES,
  COMMERCIAL_SUBSCRIPTION_STATUSES,
  PRORATION_METHODS,
  SUBSCRIPTION_ITEM_TYPES,
  type AccessPolicy,
  type BillingFrequency,
  type CommercialSubscriptionStatus,
  type ProrationMethod,
} from "@forge/contracts";
import {
  createId,
  invoices,
  subscriptionChanges,
  subscriptionEvents,
  subscriptionItems,
  subscriptionPlans,
  subscriptionPlanVersions,
  subscriptions,
  type Database,
  withTenantTransaction,
} from "@forge/database";
import { ForgeError } from "@forge/errors";
import { DOMAIN_EVENT_TYPES } from "@forge/events";
import type { ForgePrincipal } from "@forge/tenant-context";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { DATABASE } from "../../tokens.js";
import { AuditService } from "../audit/audit.service.js";
import { OutboxService } from "../outbox/outbox.service.js";
import {
  assertCommercialTransition,
  prorateCents,
  summarizeRecurringRevenue,
} from "./commercial-money.js";
import { withPlatformTransaction } from "./commercial-platform.js";
import { CommercialSequencesService } from "./commercial-sequences.service.js";
import { EntitlementSyncService } from "./entitlement-sync.service.js";

const createSchema = z.object({
  planCode: z.string().min(1).max(64),
  planVersionId: z.string().uuid().optional(),
  commercialStatus: z.enum(COMMERCIAL_SUBSCRIPTION_STATUSES).default("DRAFT"),
  currency: z.string().length(3).default("USD"),
  billingFrequency: z.enum(BILLING_FREQUENCIES).default("ANNUAL"),
  autoRenew: z.boolean().default(true),
  contractStartDate: z.string().datetime().optional(),
  renewalDate: z.string().datetime().optional(),
  billingContactName: z.string().max(200).optional(),
  billingContactEmail: z.string().email().max(320).optional(),
  accountOwnerUserId: z.string().uuid().optional(),
  notes: z.string().max(4000).optional(),
  catalogPriceCents: z.number().int().nonnegative().optional(),
  effectivePriceCents: z.number().int().nonnegative().optional(),
  implementationFeeCents: z.number().int().nonnegative().default(0),
  discountCents: z.number().int().nonnegative().default(0),
  taxExempt: z.boolean().default(false),
  taxNotes: z.string().max(2000).optional(),
  paymentTerms: z.string().max(64).default("NET_30"),
  accessPolicy: z.enum(ACCESS_POLICIES).default("FULL_ACCESS"),
  startsAt: z.string().datetime().optional(),
  currentPeriodStart: z.string().datetime().optional(),
  currentPeriodEnd: z.string().datetime().optional(),
  periodDays: z.number().int().positive().default(365),
  products: z
    .array(
      z.object({
        productCode: z.string().min(1).max(64),
        unitPriceCents: z.number().int().nonnegative().default(0),
        quantity: z.number().int().positive().default(1),
        description: z.string().max(500).optional(),
      }),
    )
    .default([]),
  modules: z
    .array(
      z.object({
        moduleCode: z.string().min(1).max(64),
        unitPriceCents: z.number().int().nonnegative().default(0),
        quantity: z.number().int().positive().default(1),
        description: z.string().max(500).optional(),
      }),
    )
    .default([]),
});

const suspendSchema = z.object({
  reason: z.string().min(1).max(2000),
  accessPolicy: z.enum(ACCESS_POLICIES).optional(),
});

const cancelSchema = z.object({
  reason: z.string().min(1).max(2000),
  effectiveDate: z.string().datetime(),
  immediate: z.boolean().default(false),
});

const renewSchema = z.object({
  periodDays: z.number().int().positive().optional(),
  autoRenew: z.boolean().optional(),
});

const addItemSchema = z.object({
  itemType: z.enum(SUBSCRIPTION_ITEM_TYPES),
  productCode: z.string().max(64).optional(),
  moduleCode: z.string().max(64).optional(),
  description: z.string().min(1).max(500),
  quantity: z.number().int().positive().default(1),
  unitPriceCents: z.number().int().nonnegative(),
  billingFrequency: z.enum(BILLING_FREQUENCIES).optional(),
  prorationMethod: z.enum(PRORATION_METHODS).default("DAILY"),
});

const previewSchema = z.object({
  billingFrequency: z.enum(BILLING_FREQUENCIES).optional(),
  effectivePriceCents: z.number().int().nonnegative().optional(),
  discountCents: z.number().int().nonnegative().optional(),
  addItems: z.array(addItemSchema).default([]),
  removeItemIds: z.array(z.string().uuid()).default([]),
  prorationMethod: z.enum(PRORATION_METHODS).default("DAILY"),
  effectiveFrom: z.string().datetime().optional(),
});

@Injectable()
export class CommercialSubscriptionsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly sequences: CommercialSequencesService,
    private readonly entitlementSync: EntitlementSyncService,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
  ) {}

  /** Cross-tenant list for platform admin (bypass RLS). */
  async listPlatform() {
    return withPlatformTransaction(this.db, async (tx) => {
      return tx.query.subscriptions.findMany({
        orderBy: [desc(subscriptions.createdAt)],
      });
    });
  }

  async list(tenantId: string) {
    return withTenantTransaction(this.db, tenantId, async (tx) => {
      return tx.query.subscriptions.findMany({
        where: eq(subscriptions.tenantId, tenantId),
        orderBy: [desc(subscriptions.createdAt)],
      });
    });
  }

  async getDetail(tenantId: string, subscriptionId: string) {
    return withTenantTransaction(this.db, tenantId, async (tx) => {
      const sub = await tx.query.subscriptions.findFirst({
        where: and(eq(subscriptions.id, subscriptionId), eq(subscriptions.tenantId, tenantId)),
      });
      if (!sub) throw new ForgeError("NOT_FOUND", "Subscription not found");

      const plan = await tx.query.subscriptionPlans.findFirst({
        where: eq(subscriptionPlans.id, sub.planId),
      });
      const items = await tx.query.subscriptionItems.findMany({
        where: and(
          eq(subscriptionItems.subscriptionId, subscriptionId),
          eq(subscriptionItems.tenantId, tenantId),
        ),
      });
      const invoiceRows = await tx.query.invoices.findMany({
        where: and(eq(invoices.subscriptionId, subscriptionId), eq(invoices.tenantId, tenantId)),
      });
      const outstandingBalanceCents = invoiceRows
        .filter((i) => i.status !== "VOID" && i.status !== "DRAFT")
        .reduce((sum, i) => sum + i.balanceCents, 0);

      const recurring = items
        .filter((i) => i.status === "ACTIVE" && i.itemType !== "IMPLEMENTATION")
        .map((i) => ({
          amountCents: i.amountCents,
          billingFrequency: i.billingFrequency as BillingFrequency,
        }));
      const revenue = summarizeRecurringRevenue(recurring);

      return {
        subscription: sub,
        plan,
        items,
        balance: {
          outstandingBalanceCents,
          arrCents: revenue.arrCents,
          mrrCents: revenue.mrrCents,
        },
      };
    });
  }

  async create(tenantId: string, input: unknown, principal: ForgePrincipal) {
    const data = createSchema.parse(input);
    return withTenantTransaction(
      this.db,
      tenantId,
      async (tx) => {
        const plan = await tx.query.subscriptionPlans.findFirst({
          where: eq(subscriptionPlans.code, data.planCode),
        });
        if (!plan) throw new ForgeError("NOT_FOUND", "Subscription plan not found");

        const planVersion =
          data.planVersionId != null
            ? await tx.query.subscriptionPlanVersions.findFirst({
                where: and(
                  eq(subscriptionPlanVersions.id, data.planVersionId),
                  eq(subscriptionPlanVersions.planId, plan.id),
                ),
              })
            : await tx.query.subscriptionPlanVersions.findFirst({
                where: and(
                  eq(subscriptionPlanVersions.planId, plan.id),
                  eq(subscriptionPlanVersions.status, "ACTIVE"),
                ),
                orderBy: [desc(subscriptionPlanVersions.versionNumber)],
              });

        const now = new Date();
        const startsAt = data.startsAt ? new Date(data.startsAt) : now;
        const periodStart = data.currentPeriodStart
          ? new Date(data.currentPeriodStart)
          : startsAt;
        const periodEnd = data.currentPeriodEnd
          ? new Date(data.currentPeriodEnd)
          : new Date(periodStart.getTime() + data.periodDays * 86_400_000);

        const catalog =
          data.catalogPriceCents ??
          planVersion?.basePriceCents ??
          plan.basePriceCents ??
          0;
        const impl =
          data.implementationFeeCents ?? planVersion?.implementationFeeCents ?? 0;
        const discount = data.discountCents ?? 0;
        const effective =
          data.effectivePriceCents ?? Math.max(0, catalog + impl - discount);

        const id = createId();
        const subscriptionNumber = await this.sequences.nextNumber(tx, "SUBSCRIPTION");

        // Legacy status column stays compatible with older endpoints.
        const legacyStatus =
          data.commercialStatus === "ACTIVE"
            ? "ACTIVE"
            : data.commercialStatus === "TRIAL"
              ? "TRIAL"
              : data.commercialStatus === "SUSPENDED"
                ? "SUSPENDED"
                : "TRIAL";

        const [row] = await tx
          .insert(subscriptions)
          .values({
            id,
            tenantId,
            planId: plan.id,
            status: legacyStatus,
            billingProvider: "MANUAL",
            startsAt,
            currentPeriodStart: periodStart,
            currentPeriodEnd: periodEnd,
            subscriptionNumber,
            commercialStatus: data.commercialStatus,
            currency: data.currency,
            billingFrequency: data.billingFrequency,
            autoRenew: data.autoRenew,
            contractStartDate: data.contractStartDate
              ? new Date(data.contractStartDate)
              : startsAt,
            renewalDate: data.renewalDate ? new Date(data.renewalDate) : periodEnd,
            billingContactName: data.billingContactName,
            billingContactEmail: data.billingContactEmail,
            accountOwnerUserId: data.accountOwnerUserId,
            notes: data.notes,
            catalogPriceCents: catalog,
            effectivePriceCents: effective,
            implementationFeeCents: impl,
            discountCents: discount,
            taxExempt: data.taxExempt,
            taxNotes: data.taxNotes,
            paymentTerms: data.paymentTerms,
            accessPolicy: data.accessPolicy,
            createdAt: now,
            updatedAt: now,
          })
          .returning();
        if (!row) throw new ForgeError("INTERNAL_ERROR", "Failed to create subscription");

        const itemRows: (typeof subscriptionItems.$inferInsert)[] = [];

        itemRows.push({
          id: createId(),
          tenantId,
          subscriptionId: id,
          itemType: "PRODUCT",
          productCode: data.planCode,
          planVersionId: planVersion?.id,
          description: `${plan.name} base`,
          quantity: 1,
          unitPriceCents: catalog,
          amountCents: catalog,
          billingFrequency: data.billingFrequency,
          status: "ACTIVE",
          startsAt: periodStart,
          endsAt: periodEnd,
          configurationJson: {},
          createdAt: now,
          updatedAt: now,
        });

        if (impl > 0) {
          itemRows.push({
            id: createId(),
            tenantId,
            subscriptionId: id,
            itemType: "IMPLEMENTATION",
            description: "Implementation fee",
            quantity: 1,
            unitPriceCents: impl,
            amountCents: impl,
            billingFrequency: data.billingFrequency,
            status: "ACTIVE",
            startsAt: periodStart,
            configurationJson: {},
            createdAt: now,
            updatedAt: now,
          });
        }

        for (const p of data.products) {
          const amount = p.unitPriceCents * p.quantity;
          itemRows.push({
            id: createId(),
            tenantId,
            subscriptionId: id,
            itemType: "PRODUCT",
            productCode: p.productCode,
            description: p.description ?? p.productCode,
            quantity: p.quantity,
            unitPriceCents: p.unitPriceCents,
            amountCents: amount,
            billingFrequency: data.billingFrequency,
            status: "ACTIVE",
            startsAt: periodStart,
            endsAt: periodEnd,
            configurationJson: {},
            createdAt: now,
            updatedAt: now,
          });
        }
        for (const m of data.modules) {
          const amount = m.unitPriceCents * m.quantity;
          itemRows.push({
            id: createId(),
            tenantId,
            subscriptionId: id,
            itemType: "MODULE",
            moduleCode: m.moduleCode,
            description: m.description ?? m.moduleCode,
            quantity: m.quantity,
            unitPriceCents: m.unitPriceCents,
            amountCents: amount,
            billingFrequency: data.billingFrequency,
            status: "ACTIVE",
            startsAt: periodStart,
            endsAt: periodEnd,
            configurationJson: {},
            createdAt: now,
            updatedAt: now,
          });
        }

        if (itemRows.length) {
          await tx.insert(subscriptionItems).values(itemRows);
        }

        await this.recordChange(tx, {
          tenantId,
          subscriptionId: id,
          changeType: "CREATED",
          summary: `Subscription ${subscriptionNumber} created`,
          before: {},
          after: row,
          actorUserId: principal.userId,
          effectiveAt: now,
        });

        await tx.insert(subscriptionEvents).values({
          id: createId(),
          tenantId,
          subscriptionId: id,
          eventType: "commercial.subscription.created",
          payloadJson: { planCode: data.planCode, commercialStatus: data.commercialStatus },
          occurredAt: now,
          createdAt: now,
        });

        await this.outbox.write(tx, {
          tenantId,
          aggregateType: "subscription",
          aggregateId: id,
          eventType: DOMAIN_EVENT_TYPES.SUBSCRIPTION_CHANGED,
          payload: {
            subscriptionId: id,
            tenantId,
            commercialStatus: data.commercialStatus,
            planCode: data.planCode,
          },
          correlationId: principal.correlationId,
          actorUserId: principal.userId,
        });

        await this.audit.writeInTransaction(tx, {
          tenantId,
          actorUserId: principal.userId,
          actorPersonId: principal.personId,
          actorType: "USER",
          action: "commercial.subscription.create",
          resourceType: "subscription",
          resourceId: id,
          result: "SUCCESS",
          riskLevel: "HIGH",
          correlationId: principal.correlationId,
          requestId: principal.requestId,
          after: row,
        });

        return row;
      },
      principal.userId,
    );
  }

  async activate(tenantId: string, subscriptionId: string, principal: ForgePrincipal) {
    return this.transition(tenantId, subscriptionId, principal, {
      to: "ACTIVE",
      changeType: "ACTIVATED",
      summary: "Subscription activated",
      legacyStatus: "ACTIVE",
      entitlementMode: "ACTIVATE",
    });
  }

  async suspend(
    tenantId: string,
    subscriptionId: string,
    input: unknown,
    principal: ForgePrincipal,
  ) {
    const data = suspendSchema.parse(input);
    return this.transition(tenantId, subscriptionId, principal, {
      to: "SUSPENDED",
      changeType: "SUSPENDED",
      summary: `Subscription suspended: ${data.reason}`,
      legacyStatus: "SUSPENDED",
      entitlementMode: "SUSPEND",
      ...(data.accessPolicy ? { accessPolicy: data.accessPolicy } : {}),
      extraSet: { suspendedAt: new Date() },
      metadata: { reason: data.reason },
    });
  }

  async reactivate(tenantId: string, subscriptionId: string, principal: ForgePrincipal) {
    return this.transition(tenantId, subscriptionId, principal, {
      to: "ACTIVE",
      changeType: "REACTIVATED",
      summary: "Subscription reactivated",
      legacyStatus: "ACTIVE",
      entitlementMode: "REACTIVATE",
      extraSet: { suspendedAt: null },
    });
  }

  async cancel(
    tenantId: string,
    subscriptionId: string,
    input: unknown,
    principal: ForgePrincipal,
  ) {
    const data = cancelSchema.parse(input);
    const effective = new Date(data.effectiveDate);
    const immediate = data.immediate || effective.getTime() <= Date.now();
    return this.transition(tenantId, subscriptionId, principal, {
      to: immediate ? "CANCELLED" : "CANCEL_SCHEDULED",
      changeType: immediate ? "CANCELLED" : "CANCEL_SCHEDULED",
      summary: `Subscription cancel: ${data.reason}`,
      ...(immediate ? { legacyStatus: "CANCELED", entitlementMode: "CANCEL" as const } : {}),
      extraSet: {
        cancelAtPeriodEnd: !immediate,
        canceledAt: immediate ? effective : null,
      },
      metadata: { reason: data.reason, effectiveDate: data.effectiveDate },
      effectiveAt: effective,
    });
  }

  async renew(
    tenantId: string,
    subscriptionId: string,
    input: unknown,
    principal: ForgePrincipal,
  ) {
    const data = renewSchema.parse(input ?? {});
    return withTenantTransaction(
      this.db,
      tenantId,
      async (tx) => {
        const before = await this.requireSub(tx, tenantId, subscriptionId);
        if (!["ACTIVE", "TRIAL", "PAST_DUE", "CANCEL_SCHEDULED"].includes(before.commercialStatus)) {
          throw new ForgeError(
            "VALIDATION_FAILED",
            `Cannot renew from status ${before.commercialStatus}`,
          );
        }
        const now = new Date();
        const periodDays =
          data.periodDays ??
          Math.max(
            1,
            Math.round(
              (before.currentPeriodEnd.getTime() - before.currentPeriodStart.getTime()) /
                86_400_000,
            ),
          );
        const periodStart = before.currentPeriodEnd > now ? before.currentPeriodEnd : now;
        const periodEnd = new Date(periodStart.getTime() + periodDays * 86_400_000);

        assertCommercialTransition(
          before.commercialStatus as CommercialSubscriptionStatus,
          "ACTIVE",
        );

        const [updated] = await tx
          .update(subscriptions)
          .set({
            commercialStatus: "ACTIVE",
            status: "ACTIVE",
            currentPeriodStart: periodStart,
            currentPeriodEnd: periodEnd,
            renewalDate: periodEnd,
            autoRenew: data.autoRenew ?? before.autoRenew,
            cancelAtPeriodEnd: false,
            canceledAt: null,
            recordVersion: before.recordVersion + 1,
            updatedAt: now,
          })
          .where(
            and(
              eq(subscriptions.id, subscriptionId),
              eq(subscriptions.recordVersion, before.recordVersion),
            ),
          )
          .returning();
        if (!updated) throw new ForgeError("CONFLICT", "Subscription was updated concurrently");

        await this.recordChange(tx, {
          tenantId,
          subscriptionId,
          changeType: "RENEWED",
          summary: "Subscription renewed",
          before,
          after: updated,
          actorUserId: principal.userId,
          effectiveAt: now,
        });
        await this.emitLifecycle(tx, tenantId, subscriptionId, principal, updated, "RENEWED");
        return updated;
      },
      principal.userId,
    );
  }

  async addItem(
    tenantId: string,
    subscriptionId: string,
    input: unknown,
    principal: ForgePrincipal,
    opts?: { previewProration?: boolean },
  ) {
    const data = addItemSchema.parse(input);
    return withTenantTransaction(
      this.db,
      tenantId,
      async (tx) => {
        const sub = await this.requireSub(tx, tenantId, subscriptionId);
        const now = new Date();
        const amount = data.unitPriceCents * data.quantity;
        const method = data.prorationMethod as ProrationMethod;
        const prorated = prorateCents({
          amountCents: amount,
          periodStart: sub.currentPeriodStart,
          periodEnd: sub.currentPeriodEnd,
          effectiveFrom: now,
          method,
        });

        if (opts?.previewProration) {
          return {
            preview: true,
            fullAmountCents: amount,
            proratedAmountCents: prorated,
            prorationMethod: method,
          };
        }

        const [item] = await tx
          .insert(subscriptionItems)
          .values({
            id: createId(),
            tenantId,
            subscriptionId,
            itemType: data.itemType,
            productCode: data.productCode,
            moduleCode: data.moduleCode,
            description: data.description,
            quantity: data.quantity,
            unitPriceCents: data.unitPriceCents,
            amountCents: amount,
            billingFrequency: data.billingFrequency ?? sub.billingFrequency,
            status: "ACTIVE",
            startsAt: now,
            endsAt: sub.currentPeriodEnd,
            configurationJson: { proratedAmountCents: prorated, prorationMethod: method },
            createdAt: now,
            updatedAt: now,
          })
          .returning();

        await this.recordChange(tx, {
          tenantId,
          subscriptionId,
          changeType: "ITEM_ADDED",
          summary: `Added item: ${data.description}`,
          before: {},
          after: item,
          actorUserId: principal.userId,
          effectiveAt: now,
        });
        await this.audit.writeInTransaction(tx, {
          tenantId,
          actorUserId: principal.userId,
          actorPersonId: principal.personId,
          actorType: "USER",
          action: "commercial.subscription.item.add",
          resourceType: "subscription_item",
          resourceId: item!.id,
          result: "SUCCESS",
          riskLevel: "MEDIUM",
          correlationId: principal.correlationId,
          requestId: principal.requestId,
          after: item,
        });
        return { item, proratedAmountCents: prorated };
      },
      principal.userId,
    );
  }

  async previewChange(tenantId: string, subscriptionId: string, input: unknown) {
    const data = previewSchema.parse(input);
    return withTenantTransaction(this.db, tenantId, async (tx) => {
      const sub = await this.requireSub(tx, tenantId, subscriptionId);
      const items = await tx.query.subscriptionItems.findMany({
        where: and(
          eq(subscriptionItems.subscriptionId, subscriptionId),
          eq(subscriptionItems.tenantId, tenantId),
          eq(subscriptionItems.status, "ACTIVE"),
        ),
      });

      const remove = new Set(data.removeItemIds);
      const remaining = items.filter((i) => !remove.has(i.id));
      const effectiveFrom = data.effectiveFrom ? new Date(data.effectiveFrom) : new Date();

      const proposedAdds = data.addItems.map((a) => {
        const amount = a.unitPriceCents * a.quantity;
        const prorated = prorateCents({
          amountCents: amount,
          periodStart: sub.currentPeriodStart,
          periodEnd: sub.currentPeriodEnd,
          effectiveFrom,
          method: data.prorationMethod,
        });
        return { ...a, amountCents: amount, proratedAmountCents: prorated };
      });

      const currentRecurring = remaining
        .filter((i) => i.itemType !== "IMPLEMENTATION")
        .reduce((s, i) => s + i.amountCents, 0);
      const proposedRecurring =
        currentRecurring + proposedAdds.reduce((s, a) => s + a.amountCents, 0);
      const prorationImpact = proposedAdds.reduce((s, a) => s + a.proratedAmountCents, 0);

      const freq = (data.billingFrequency ?? sub.billingFrequency) as BillingFrequency;
      const currentRevenue = summarizeRecurringRevenue(
        remaining
          .filter((i) => i.itemType !== "IMPLEMENTATION")
          .map((i) => ({
            amountCents: i.amountCents,
            billingFrequency: i.billingFrequency as BillingFrequency,
          })),
      );
      const proposedRevenue = summarizeRecurringRevenue([
        ...remaining
          .filter((i) => i.itemType !== "IMPLEMENTATION")
          .map((i) => ({
            amountCents: i.amountCents,
            billingFrequency: (data.billingFrequency ?? i.billingFrequency) as BillingFrequency,
          })),
        ...proposedAdds.map((a) => ({
          amountCents: a.amountCents,
          billingFrequency: (a.billingFrequency ?? freq) as BillingFrequency,
        })),
      ]);

      return {
        CURRENT: {
          subscription: sub,
          items: remaining,
          effectivePriceCents: sub.effectivePriceCents,
          arrCents: currentRevenue.arrCents,
          mrrCents: currentRevenue.mrrCents,
        },
        PROPOSED: {
          billingFrequency: freq,
          effectivePriceCents: data.effectivePriceCents ?? proposedRecurring,
          discountCents: data.discountCents ?? sub.discountCents,
          addItems: proposedAdds,
          removeItemIds: data.removeItemIds,
          arrCents: proposedRevenue.arrCents,
          mrrCents: proposedRevenue.mrrCents,
        },
        FINANCIAL_IMPACT: {
          recurringDeltaCents: proposedRecurring - currentRecurring,
          prorationDueCents: prorationImpact,
          arrDeltaCents: proposedRevenue.arrCents - currentRevenue.arrCents,
          mrrDeltaCents: proposedRevenue.mrrCents - currentRevenue.mrrCents,
        },
      };
    });
  }

  async listChanges(tenantId: string, subscriptionId: string) {
    return withTenantTransaction(this.db, tenantId, async (tx) => {
      await this.requireSub(tx, tenantId, subscriptionId);
      const changes = await tx.query.subscriptionChanges.findMany({
        where: and(
          eq(subscriptionChanges.subscriptionId, subscriptionId),
          eq(subscriptionChanges.tenantId, tenantId),
        ),
        orderBy: [desc(subscriptionChanges.createdAt)],
      });
      const events = await tx.query.subscriptionEvents.findMany({
        where: and(
          eq(subscriptionEvents.subscriptionId, subscriptionId),
          eq(subscriptionEvents.tenantId, tenantId),
        ),
        orderBy: [desc(subscriptionEvents.occurredAt)],
      });
      return { changes, events };
    });
  }

  private async transition(
    tenantId: string,
    subscriptionId: string,
    principal: ForgePrincipal,
    opts: {
      to: CommercialSubscriptionStatus;
      changeType: string;
      summary: string;
      legacyStatus?: string;
      entitlementMode?: "ACTIVATE" | "SUSPEND" | "CANCEL" | "REACTIVATE";
      accessPolicy?: AccessPolicy;
      extraSet?: Record<string, unknown>;
      metadata?: Record<string, unknown>;
      effectiveAt?: Date;
    },
  ) {
    return withTenantTransaction(
      this.db,
      tenantId,
      async (tx) => {
        const before = await this.requireSub(tx, tenantId, subscriptionId);
        assertCommercialTransition(
          before.commercialStatus as CommercialSubscriptionStatus,
          opts.to,
        );
        const now = new Date();
        const [updated] = await tx
          .update(subscriptions)
          .set({
            commercialStatus: opts.to,
            ...(opts.legacyStatus ? { status: opts.legacyStatus } : {}),
            ...(opts.accessPolicy ? { accessPolicy: opts.accessPolicy } : {}),
            ...opts.extraSet,
            recordVersion: before.recordVersion + 1,
            updatedAt: now,
          })
          .where(
            and(
              eq(subscriptions.id, subscriptionId),
              eq(subscriptions.recordVersion, before.recordVersion),
            ),
          )
          .returning();
        if (!updated) throw new ForgeError("CONFLICT", "Subscription was updated concurrently");

        let syncState: "COMPLETE" | "FAILED" | undefined;
        if (opts.entitlementMode) {
          const sync = await this.entitlementSync.applySubscriptionEntitlements(
            tx,
            tenantId,
            subscriptionId,
            principal,
            {
              mode: opts.entitlementMode,
              accessPolicy:
                opts.accessPolicy ?? (updated.accessPolicy as AccessPolicy) ?? "FULL_ACCESS",
            },
          );
          syncState = sync.state;
          if (sync.state === "FAILED") {
            throw new ForgeError(
              "INTERNAL_ERROR",
              `Entitlement sync failed: ${sync.detail ?? "unknown"}`,
            );
          }
        }

        await this.recordChange(tx, {
          tenantId,
          subscriptionId,
          changeType: opts.changeType,
          summary: opts.summary,
          before,
          after: { ...updated, ...(opts.metadata ?? {}) },
          actorUserId: principal.userId,
          effectiveAt: opts.effectiveAt ?? now,
        });
        await this.emitLifecycle(tx, tenantId, subscriptionId, principal, updated, opts.changeType);
        return { ...updated, entitlementSyncState: syncState };
      },
      principal.userId,
    );
  }

  private async requireSub(
    tx: Parameters<Parameters<typeof withTenantTransaction>[2]>[0],
    tenantId: string,
    subscriptionId: string,
  ) {
    const row = await tx.query.subscriptions.findFirst({
      where: and(eq(subscriptions.id, subscriptionId), eq(subscriptions.tenantId, tenantId)),
    });
    if (!row) throw new ForgeError("NOT_FOUND", "Subscription not found");
    return row;
  }

  private async recordChange(
    tx: Parameters<Parameters<typeof withTenantTransaction>[2]>[0],
    input: {
      tenantId: string;
      subscriptionId: string;
      changeType: string;
      summary: string;
      before: unknown;
      after: unknown;
      actorUserId: string | null;
      effectiveAt: Date;
    },
  ) {
    await tx.insert(subscriptionChanges).values({
      id: createId(),
      tenantId: input.tenantId,
      subscriptionId: input.subscriptionId,
      changeType: input.changeType,
      summary: input.summary,
      beforeJson: (input.before ?? {}) as Record<string, unknown>,
      afterJson: (input.after ?? {}) as Record<string, unknown>,
      effectiveAt: input.effectiveAt,
      actorUserId: input.actorUserId,
      createdAt: new Date(),
    });
  }

  private async emitLifecycle(
    tx: Parameters<Parameters<typeof withTenantTransaction>[2]>[0],
    tenantId: string,
    subscriptionId: string,
    principal: ForgePrincipal,
    after: unknown,
    eventType: string,
  ) {
    const now = new Date();
    await tx.insert(subscriptionEvents).values({
      id: createId(),
      tenantId,
      subscriptionId,
      eventType: `commercial.subscription.${eventType.toLowerCase()}`,
      payloadJson: { after },
      occurredAt: now,
      createdAt: now,
    });
    await this.outbox.write(tx, {
      tenantId,
      aggregateType: "subscription",
      aggregateId: subscriptionId,
      eventType: DOMAIN_EVENT_TYPES.SUBSCRIPTION_CHANGED,
      payload: { subscriptionId, tenantId, eventType, after },
      correlationId: principal.correlationId,
      actorUserId: principal.userId,
    });
    await this.audit.writeInTransaction(tx, {
      tenantId,
      actorUserId: principal.userId,
      actorPersonId: principal.personId,
      actorType: "USER",
      action: `commercial.subscription.${eventType.toLowerCase()}`,
      resourceType: "subscription",
      resourceId: subscriptionId,
      result: "SUCCESS",
      riskLevel: "HIGH",
      correlationId: principal.correlationId,
      requestId: principal.requestId,
      after: after as Record<string, unknown>,
    });
  }
}
