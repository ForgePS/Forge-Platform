import { Inject, Injectable } from "@nestjs/common";
import { recordPaymentInputSchema, type RecordPaymentInput } from "@forge/contracts";
import {
  createId,
  invoices,
  paymentAllocations,
  payments,
  type Database,
  withTenantTransaction,
} from "@forge/database";
import { ForgeError } from "@forge/errors";
import type { ForgePrincipal } from "@forge/tenant-context";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { DATABASE } from "../../tokens.js";
import { AuditService } from "../audit/audit.service.js";
import {
  applyAllocationToInvoice,
  assertPaymentAllocations,
} from "./commercial-money.js";
import { CommercialSequencesService } from "./commercial-sequences.service.js";

const allocateSchema = z.object({
  allocations: z
    .array(
      z.object({
        invoiceId: z.string().uuid(),
        amountCents: z.number().int().positive(),
      }),
    )
    .min(1),
});

/** Never store card numbers — only method enum + external reference. */
@Injectable()
export class PaymentsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly sequences: CommercialSequencesService,
    private readonly audit: AuditService,
  ) {}

  async list(tenantId: string) {
    return withTenantTransaction(this.db, tenantId, async (tx) => {
      return tx.query.payments.findMany({
        where: eq(payments.tenantId, tenantId),
        orderBy: [desc(payments.paymentDate)],
      });
    });
  }

  async record(tenantId: string, input: unknown, principal: ForgePrincipal) {
    const parsed = recordPaymentInputSchema.parse({ ...((input as object) ?? {}), tenantId });
    const data = parsed as RecordPaymentInput;
    if (data.tenantId !== tenantId) {
      throw new ForgeError("VALIDATION_FAILED", "tenantId mismatch");
    }
    // Strip any accidental PAN-like fields from notes/reference length already capped.
    assertPaymentAllocations(data.amountCents, data.allocations);

    return withTenantTransaction(
      this.db,
      tenantId,
      async (tx) => {
        const paymentDate = new Date(data.paymentDate);
        const paymentNumber = await this.sequences.nextNumber(tx, "PAYMENT");
        const id = createId();
        const now = new Date();
        const [payment] = await tx
          .insert(payments)
          .values({
            id,
            tenantId,
            paymentNumber,
            paymentDate,
            amountCents: data.amountCents,
            currency: data.currency,
            method: data.method,
            reference: data.reference,
            notes: data.notes,
            recordedByUserId: principal.userId,
            billingProvider: "MANUAL",
            createdAt: now,
            updatedAt: now,
          })
          .returning();
        if (!payment) throw new ForgeError("INTERNAL_ERROR", "Failed to record payment");

        for (const alloc of data.allocations) {
          await this.applyOneAllocation(tx, tenantId, id, alloc.invoiceId, alloc.amountCents);
        }

        await this.audit.writeInTransaction(tx, {
          tenantId,
          actorUserId: principal.userId,
          actorPersonId: principal.personId,
          actorType: "USER",
          action: "commercial.payment.record",
          resourceType: "payment",
          resourceId: id,
          result: "SUCCESS",
          riskLevel: "HIGH",
          correlationId: principal.correlationId,
          requestId: principal.requestId,
          after: { ...payment, allocations: data.allocations },
        });
        return payment;
      },
      principal.userId,
    );
  }

  async allocate(
    tenantId: string,
    paymentId: string,
    input: unknown,
    principal: ForgePrincipal,
  ) {
    const data = allocateSchema.parse(input);
    return withTenantTransaction(
      this.db,
      tenantId,
      async (tx) => {
        const payment = await tx.query.payments.findFirst({
          where: and(eq(payments.id, paymentId), eq(payments.tenantId, tenantId)),
        });
        if (!payment) throw new ForgeError("NOT_FOUND", "Payment not found");

        const existing = await tx.query.paymentAllocations.findMany({
          where: and(
            eq(paymentAllocations.paymentId, paymentId),
            eq(paymentAllocations.tenantId, tenantId),
          ),
        });
        const already = existing.reduce((s, a) => s + a.amountCents, 0);
        const incoming = data.allocations.reduce((s, a) => s + a.amountCents, 0);
        if (already + incoming > payment.amountCents) {
          throw new ForgeError(
            "VALIDATION_FAILED",
            "allocations exceed payment amount",
          );
        }

        const applied = [];
        for (const alloc of data.allocations) {
          applied.push(
            await this.applyOneAllocation(
              tx,
              tenantId,
              paymentId,
              alloc.invoiceId,
              alloc.amountCents,
            ),
          );
        }

        await this.audit.writeInTransaction(tx, {
          tenantId,
          actorUserId: principal.userId,
          actorPersonId: principal.personId,
          actorType: "USER",
          action: "commercial.payment.allocate",
          resourceType: "payment",
          resourceId: paymentId,
          result: "SUCCESS",
          riskLevel: "HIGH",
          correlationId: principal.correlationId,
          requestId: principal.requestId,
          after: { allocations: data.allocations },
        });
        return { payment, allocations: applied };
      },
      principal.userId,
    );
  }

  private async applyOneAllocation(
    tx: Parameters<Parameters<typeof withTenantTransaction>[2]>[0],
    tenantId: string,
    paymentId: string,
    invoiceId: string,
    amountCents: number,
  ) {
    const invoice = await tx.query.invoices.findFirst({
      where: and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)),
    });
    if (!invoice) throw new ForgeError("NOT_FOUND", `Invoice ${invoiceId} not found`);
    if (invoice.status === "VOID" || invoice.status === "DRAFT") {
      throw new ForgeError("VALIDATION_FAILED", "Cannot allocate to DRAFT/VOID invoice");
    }

    const next = applyAllocationToInvoice({
      totalCents: invoice.totalCents,
      amountPaidCents: invoice.amountPaidCents,
      allocationCents: amountCents,
    });

    const [alloc] = await tx
      .insert(paymentAllocations)
      .values({
        id: createId(),
        tenantId,
        paymentId,
        invoiceId,
        amountCents,
        createdAt: new Date(),
      })
      .returning();

    await tx
      .update(invoices)
      .set({
        amountPaidCents: next.amountPaidCents,
        balanceCents: next.balanceCents,
        status: next.status,
        updatedAt: new Date(),
        recordVersion: invoice.recordVersion + 1,
      })
      .where(eq(invoices.id, invoiceId));

    return alloc;
  }
}
