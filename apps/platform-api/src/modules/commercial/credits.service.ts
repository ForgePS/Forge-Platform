import { Inject, Injectable } from "@nestjs/common";
import { applyCreditInputSchema, type ApplyCreditInput } from "@forge/contracts";
import {
  accountCredits,
  createId,
  invoices,
  type Database,
  withTenantTransaction,
} from "@forge/database";
import { ForgeError } from "@forge/errors";
import type { ForgePrincipal } from "@forge/tenant-context";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { DATABASE } from "../../tokens.js";
import { AuditService } from "../audit/audit.service.js";
import { recalculateInvoiceTotals, subtractCents } from "./commercial-money.js";
import { CommercialSequencesService } from "./commercial-sequences.service.js";

const applyToInvoiceSchema = z.object({
  invoiceId: z.string().uuid(),
  amountCents: z.number().int().positive(),
});

@Injectable()
export class CreditsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly sequences: CommercialSequencesService,
    private readonly audit: AuditService,
  ) {}

  async list(tenantId: string) {
    return withTenantTransaction(this.db, tenantId, async (tx) => {
      return tx.query.accountCredits.findMany({
        where: eq(accountCredits.tenantId, tenantId),
        orderBy: [desc(accountCredits.createdAt)],
      });
    });
  }

  async create(tenantId: string, input: unknown, principal: ForgePrincipal) {
    const parsed = applyCreditInputSchema.parse({ ...((input as object) ?? {}), tenantId });
    const data = parsed as ApplyCreditInput;
    return withTenantTransaction(
      this.db,
      tenantId,
      async (tx) => {
        const creditNumber = await this.sequences.nextNumber(tx, "CREDIT");
        const now = new Date();
        const [row] = await tx
          .insert(accountCredits)
          .values({
            id: createId(),
            tenantId,
            creditNumber,
            reason: data.reason,
            amountCents: data.amountCents,
            appliedCents: 0,
            remainingCents: data.amountCents,
            expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
            status: "AVAILABLE",
            createdByUserId: principal.userId,
            createdAt: now,
            updatedAt: now,
          })
          .returning();
        if (!row) throw new ForgeError("INTERNAL_ERROR", "Failed to create credit");

        await this.audit.writeInTransaction(tx, {
          tenantId,
          actorUserId: principal.userId,
          actorPersonId: principal.personId,
          actorType: "USER",
          action: "commercial.credit.create",
          resourceType: "account_credit",
          resourceId: row.id,
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

  async apply(
    tenantId: string,
    creditId: string,
    input: unknown,
    principal: ForgePrincipal,
  ) {
    const data = applyToInvoiceSchema.parse(input);
    return withTenantTransaction(
      this.db,
      tenantId,
      async (tx) => {
        const credit = await tx.query.accountCredits.findFirst({
          where: and(eq(accountCredits.id, creditId), eq(accountCredits.tenantId, tenantId)),
        });
        if (!credit) throw new ForgeError("NOT_FOUND", "Credit not found");
        if (credit.status !== "AVAILABLE" || credit.remainingCents <= 0) {
          throw new ForgeError("VALIDATION_FAILED", "Credit not available");
        }
        if (data.amountCents > credit.remainingCents) {
          throw new ForgeError("VALIDATION_FAILED", "Amount exceeds remaining credit");
        }

        const invoice = await tx.query.invoices.findFirst({
          where: and(eq(invoices.id, data.invoiceId), eq(invoices.tenantId, tenantId)),
        });
        if (!invoice) throw new ForgeError("NOT_FOUND", "Invoice not found");
        if (invoice.status === "VOID" || invoice.status === "DRAFT") {
          throw new ForgeError("VALIDATION_FAILED", "Cannot apply credit to DRAFT/VOID invoice");
        }

        const newCreditCents = invoice.creditCents + data.amountCents;
        const totals = recalculateInvoiceTotals({
          subtotalCents: invoice.subtotalCents,
          discountCents: invoice.discountCents,
          taxCents: invoice.taxCents,
          creditCents: newCreditCents,
          amountPaidCents: invoice.amountPaidCents,
        });

        const [updatedInvoice] = await tx
          .update(invoices)
          .set({
            creditCents: totals.creditCents,
            totalCents: totals.totalCents,
            balanceCents: totals.balanceCents,
            status: totals.status === "OPEN" && invoice.status === "SENT" ? "SENT" : totals.status,
            updatedAt: new Date(),
            recordVersion: invoice.recordVersion + 1,
          })
          .where(eq(invoices.id, invoice.id))
          .returning();

        const remaining = subtractCents(credit.remainingCents, data.amountCents);
        const applied = credit.appliedCents + data.amountCents;
        const [updatedCredit] = await tx
          .update(accountCredits)
          .set({
            appliedCents: applied,
            remainingCents: remaining,
            status: remaining === 0 ? "APPLIED" : "AVAILABLE",
            updatedAt: new Date(),
          })
          .where(eq(accountCredits.id, creditId))
          .returning();

        await this.audit.writeInTransaction(tx, {
          tenantId,
          actorUserId: principal.userId,
          actorPersonId: principal.personId,
          actorType: "USER",
          action: "commercial.credit.apply",
          resourceType: "account_credit",
          resourceId: creditId,
          result: "SUCCESS",
          riskLevel: "HIGH",
          correlationId: principal.correlationId,
          requestId: principal.requestId,
          after: { credit: updatedCredit, invoice: updatedInvoice, amountCents: data.amountCents },
        });
        return { credit: updatedCredit, invoice: updatedInvoice };
      },
      principal.userId,
    );
  }
}
