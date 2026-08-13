import { Inject, Injectable } from "@nestjs/common";
import { invoices, type Database } from "@forge/database";
import { and, eq, lt, sql } from "drizzle-orm";
import { DATABASE } from "../../tokens.js";
import { withPlatformTransaction } from "./commercial-platform.js";

/**
 * Idempotent commercial maintenance jobs.
 * Wire to EventBridge / worker schedules in a follow-on deploy.
 * External email delivery must report PENDING EMAIL SERVICE until SES is ready.
 */
@Injectable()
export class CommercialJobsService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /** Mark OPEN/SENT invoices past due when due_date < today and balance > 0. */
  async markPastDueInvoices(): Promise<{ updated: number }> {
    return withPlatformTransaction(this.db, async (tx) => {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const result = await tx
        .update(invoices)
        .set({ status: "PAST_DUE", updatedAt: new Date() })
        .where(
          and(
            sql`${invoices.status} in ('OPEN','SENT','PARTIALLY_PAID')`,
            lt(invoices.dueDate, today),
            sql`${invoices.balanceCents} > 0`,
          ),
        )
        .returning({ id: invoices.id });
      return { updated: result.length };
    });
  }

  async dunningCandidates(): Promise<
    Array<{ invoiceId: string; tenantId: string; daysPastDue: number; stage: string }>
  > {
    return withPlatformTransaction(this.db, async (tx) => {
      const rows = await tx.query.invoices.findMany({
        where: and(eq(invoices.status, "PAST_DUE"), sql`${invoices.balanceCents} > 0`),
        limit: 200,
      });
      const now = Date.now();
      return rows.map((row) => {
        const due = row.dueDate ? new Date(row.dueDate).getTime() : now;
        const days = Math.max(0, Math.floor((now - due) / 86_400_000));
        const stage =
          days >= 30
            ? "FINAL_NOTICE"
            : days >= 15
              ? "15_DAYS"
              : days >= 7
                ? "7_DAYS"
                : days >= 3
                  ? "3_DAYS"
                  : "DUE";
        return {
          invoiceId: row.id,
          tenantId: row.tenantId,
          daysPastDue: days,
          stage,
        };
      });
    });
  }
}
