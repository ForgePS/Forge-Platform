import { Inject, Injectable } from "@nestjs/common";
import { createInvoiceInputSchema, type CreateInvoiceInput } from "@forge/contracts";
import {
  createId,
  invoiceLineItems,
  invoices,
  subscriptionItems,
  subscriptions,
  type Database,
  withTenantTransaction,
} from "@forge/database";
import { ForgeError } from "@forge/errors";
import type { ForgePrincipal } from "@forge/tenant-context";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { DATABASE } from "../../tokens.js";
import { AuditService } from "../audit/audit.service.js";
import { recalculateInvoiceTotals } from "./commercial-money.js";
import { CommercialSequencesService } from "./commercial-sequences.service.js";

const finalizeSchema = z.object({
  notes: z.string().max(4000).optional(),
});

@Injectable()
export class InvoicesService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly sequences: CommercialSequencesService,
    private readonly audit: AuditService,
  ) {}

  async list(tenantId: string) {
    return withTenantTransaction(this.db, tenantId, async (tx) => {
      return tx.query.invoices.findMany({
        where: eq(invoices.tenantId, tenantId),
        orderBy: [desc(invoices.issueDate)],
      });
    });
  }

  async getDetail(tenantId: string, invoiceId: string) {
    return withTenantTransaction(this.db, tenantId, async (tx) => {
      const invoice = await tx.query.invoices.findFirst({
        where: and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)),
      });
      if (!invoice) throw new ForgeError("NOT_FOUND", "Invoice not found");
      const lines = await tx.query.invoiceLineItems.findMany({
        where: and(eq(invoiceLineItems.invoiceId, invoiceId), eq(invoiceLineItems.tenantId, tenantId)),
      });
      return { invoice, lineItems: lines };
    });
  }

  async create(tenantId: string, input: unknown, principal: ForgePrincipal) {
    const parsed = createInvoiceInputSchema.parse({ ...((input as object) ?? {}), tenantId });
    const data = parsed as CreateInvoiceInput;
    if (data.tenantId !== tenantId) {
      throw new ForgeError("VALIDATION_FAILED", "tenantId mismatch");
    }
    return withTenantTransaction(
      this.db,
      tenantId,
      async (tx) => {
        const issueDate = new Date(data.issueDate);
        const dueDate = new Date(data.dueDate);
        const totals = recalculateInvoiceTotals({
          subtotalCents: data.subtotalCents,
          discountCents: data.discountCents,
          taxCents: data.taxCents,
          creditCents: data.creditCents,
        });
        const invoiceNumber = await this.sequences.nextNumber(tx, "INVOICE", { at: issueDate });
        const id = createId();
        const now = new Date();
        const [invoice] = await tx
          .insert(invoices)
          .values({
            id,
            tenantId,
            subscriptionId: data.subscriptionId,
            invoiceNumber,
            status: "DRAFT",
            currency: data.currency,
            issueDate,
            dueDate,
            subtotalCents: totals.subtotalCents,
            discountCents: totals.discountCents,
            taxCents: totals.taxCents,
            creditCents: totals.creditCents,
            totalCents: totals.totalCents,
            amountPaidCents: 0,
            balanceCents: totals.totalCents,
            notes: data.notes,
            billingProvider: "MANUAL",
            createdAt: now,
            updatedAt: now,
          })
          .returning();
        if (!invoice) throw new ForgeError("INTERNAL_ERROR", "Failed to create invoice");

        if (data.lineItems.length) {
          await tx.insert(invoiceLineItems).values(
            data.lineItems.map((line) => ({
              id: createId(),
              tenantId,
              invoiceId: id,
              lineType: line.lineType,
              description: line.description,
              quantity: line.quantity,
              unitPriceCents: line.unitPriceCents,
              amountCents: line.amountCents,
              periodStart: line.periodStart ? new Date(line.periodStart) : null,
              periodEnd: line.periodEnd ? new Date(line.periodEnd) : null,
              productCode: line.productCode,
              moduleCode: line.moduleCode,
              createdAt: now,
            })),
          );
        }

        await this.audit.writeInTransaction(tx, {
          tenantId,
          actorUserId: principal.userId,
          actorPersonId: principal.personId,
          actorType: "USER",
          action: "commercial.invoice.create",
          resourceType: "invoice",
          resourceId: id,
          result: "SUCCESS",
          riskLevel: "MEDIUM",
          correlationId: principal.correlationId,
          requestId: principal.requestId,
          after: invoice,
        });
        return invoice;
      },
      principal.userId,
    );
  }

  async generateFromSubscription(
    tenantId: string,
    subscriptionId: string,
    principal: ForgePrincipal,
  ) {
    return withTenantTransaction(
      this.db,
      tenantId,
      async (tx) => {
        const sub = await tx.query.subscriptions.findFirst({
          where: and(eq(subscriptions.id, subscriptionId), eq(subscriptions.tenantId, tenantId)),
        });
        if (!sub) throw new ForgeError("NOT_FOUND", "Subscription not found");
        const items = await tx.query.subscriptionItems.findMany({
          where: and(
            eq(subscriptionItems.subscriptionId, subscriptionId),
            eq(subscriptionItems.tenantId, tenantId),
            eq(subscriptionItems.status, "ACTIVE"),
          ),
        });
        const now = new Date();
        const subtotal = items.reduce((s, i) => s + i.amountCents, 0);
        const discount = sub.discountCents ?? 0;
        const totals = recalculateInvoiceTotals({
          subtotalCents: subtotal,
          discountCents: discount,
        });
        const invoiceNumber = await this.sequences.nextNumber(tx, "INVOICE", { at: now });
        const due = new Date(now.getTime() + 30 * 86_400_000);
        const id = createId();
        const [invoice] = await tx
          .insert(invoices)
          .values({
            id,
            tenantId,
            subscriptionId,
            invoiceNumber,
            currency: sub.currency,
            issueDate: now,
            dueDate: due,
            subtotalCents: totals.subtotalCents,
            discountCents: totals.discountCents,
            taxCents: totals.taxCents,
            creditCents: totals.creditCents,
            totalCents: totals.totalCents,
            amountPaidCents: 0,
            balanceCents: totals.totalCents,
            status: "DRAFT",
            billingProvider: "MANUAL",
            createdAt: now,
            updatedAt: now,
          })
          .returning();
        if (!invoice) throw new ForgeError("INTERNAL_ERROR", "Failed to generate invoice");

        if (items.length) {
          await tx.insert(invoiceLineItems).values(
            items.map((item) => ({
              id: createId(),
              tenantId,
              invoiceId: id,
              lineType: item.itemType,
              description: item.description,
              quantity: item.quantity,
              unitPriceCents: item.unitPriceCents,
              amountCents: item.amountCents,
              periodStart: sub.currentPeriodStart,
              periodEnd: sub.currentPeriodEnd,
              productCode: item.productCode,
              moduleCode: item.moduleCode,
              createdAt: now,
            })),
          );
        }

        await this.audit.writeInTransaction(tx, {
          tenantId,
          actorUserId: principal.userId,
          actorPersonId: principal.personId,
          actorType: "USER",
          action: "commercial.invoice.generate",
          resourceType: "invoice",
          resourceId: id,
          result: "SUCCESS",
          riskLevel: "MEDIUM",
          correlationId: principal.correlationId,
          requestId: principal.requestId,
          after: invoice,
        });
        return invoice;
      },
      principal.userId,
    );
  }

  async finalize(
    tenantId: string,
    invoiceId: string,
    input: unknown,
    principal: ForgePrincipal,
  ) {
    finalizeSchema.parse(input ?? {});
    return withTenantTransaction(
      this.db,
      tenantId,
      async (tx) => {
        const before = await tx.query.invoices.findFirst({
          where: and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)),
        });
        if (!before) throw new ForgeError("NOT_FOUND", "Invoice not found");
        if (before.status !== "DRAFT") {
          throw new ForgeError("VALIDATION_FAILED", "Only DRAFT invoices can be finalized");
        }
        const now = new Date();
        const totals = recalculateInvoiceTotals({
          subtotalCents: before.subtotalCents,
          discountCents: before.discountCents,
          taxCents: before.taxCents,
          creditCents: before.creditCents,
          amountPaidCents: before.amountPaidCents,
        });
        const [updated] = await tx
          .update(invoices)
          .set({
            status: "OPEN",
            totalCents: totals.totalCents,
            balanceCents: totals.balanceCents,
            finalizedAt: now,
            updatedAt: now,
            recordVersion: before.recordVersion + 1,
          })
          .where(eq(invoices.id, invoiceId))
          .returning();

        await this.audit.writeInTransaction(tx, {
          tenantId,
          actorUserId: principal.userId,
          actorPersonId: principal.personId,
          actorType: "USER",
          action: "commercial.invoice.finalize",
          resourceType: "invoice",
          resourceId: invoiceId,
          result: "SUCCESS",
          riskLevel: "HIGH",
          correlationId: principal.correlationId,
          requestId: principal.requestId,
          before,
          after: updated,
        });
        return updated;
      },
      principal.userId,
    );
  }

  async voidInvoice(tenantId: string, invoiceId: string, principal: ForgePrincipal) {
    return withTenantTransaction(
      this.db,
      tenantId,
      async (tx) => {
        const before = await tx.query.invoices.findFirst({
          where: and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)),
        });
        if (!before) throw new ForgeError("NOT_FOUND", "Invoice not found");
        if (before.status === "VOID") {
          throw new ForgeError("VALIDATION_FAILED", "Invoice already void");
        }
        if (before.status === "DRAFT") {
          throw new ForgeError("VALIDATION_FAILED", "Void DRAFT by deleting; finalize path uses void");
        }
        // Immutable after finalize: void only (no field edits).
        const now = new Date();
        const [updated] = await tx
          .update(invoices)
          .set({
            status: "VOID",
            voidedAt: now,
            balanceCents: 0,
            updatedAt: now,
            recordVersion: before.recordVersion + 1,
          })
          .where(eq(invoices.id, invoiceId))
          .returning();

        await this.audit.writeInTransaction(tx, {
          tenantId,
          actorUserId: principal.userId,
          actorPersonId: principal.personId,
          actorType: "USER",
          action: "commercial.invoice.void",
          resourceType: "invoice",
          resourceId: invoiceId,
          result: "SUCCESS",
          riskLevel: "HIGH",
          correlationId: principal.correlationId,
          requestId: principal.requestId,
          before,
          after: updated,
        });
        return updated;
      },
      principal.userId,
    );
  }
}
