import { Inject, Injectable } from "@nestjs/common";
import type { BillingFrequency } from "@forge/contracts";
import {
  invoices,
  subscriptionItems,
  subscriptions,
  type Database,
} from "@forge/database";
import { and, asc, eq, gte, inArray, lte, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { DATABASE } from "../../tokens.js";
import { summarizeRecurringRevenue } from "./commercial-money.js";
import { withPlatformTransaction } from "./commercial-platform.js";

const renewalsQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  status: z.string().optional(),
  tenantId: z.string().uuid().optional(),
});

@Injectable()
export class RevenueService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /** Platform analytics from live commercial data only (no estimates). */
  async summary() {
    return withPlatformTransaction(this.db, async (tx) => {
      const activeSubs = await tx.query.subscriptions.findMany({
        where: inArray(subscriptions.commercialStatus, ["ACTIVE", "TRIAL", "PAST_DUE"]),
      });

      const activeIds = activeSubs.map((s) => s.id);
      const items =
        activeIds.length === 0
          ? []
          : await tx.query.subscriptionItems.findMany({
              where: and(
                inArray(subscriptionItems.subscriptionId, activeIds),
                eq(subscriptionItems.status, "ACTIVE"),
                ne(subscriptionItems.itemType, "IMPLEMENTATION"),
              ),
            });

      const revenue = summarizeRecurringRevenue(
        items.map((i) => ({
          amountCents: i.amountCents,
          billingFrequency: i.billingFrequency as BillingFrequency,
        })),
      );

      const now = new Date();
      const in30 = new Date(now.getTime() + 30 * 86_400_000);
      const upcomingRenewals = activeSubs.filter(
        (s) => s.renewalDate && s.renewalDate >= now && s.renewalDate <= in30,
      );

      const openInvoices = await tx.query.invoices.findMany({
        where: inArray(invoices.status, ["OPEN", "SENT", "PARTIALLY_PAID", "PAST_DUE"]),
      });
      const outstandingBalanceCents = openInvoices.reduce((s, i) => s + i.balanceCents, 0);

      return {
        arrCents: revenue.arrCents,
        mrrCents: revenue.mrrCents,
        activeSubscriptionCount: activeSubs.length,
        upcomingRenewalsCount: upcomingRenewals.length,
        outstandingBalanceCents,
        asOf: now.toISOString(),
      };
    });
  }

  async renewals(query: unknown) {
    const q = renewalsQuerySchema.parse(query ?? {});
    return withPlatformTransaction(this.db, async (tx) => {
      const conditions = [];
      if (q.tenantId) conditions.push(eq(subscriptions.tenantId, q.tenantId));
      if (q.status) conditions.push(eq(subscriptions.commercialStatus, q.status));
      if (q.from) conditions.push(gte(subscriptions.renewalDate, new Date(q.from)));
      if (q.to) conditions.push(lte(subscriptions.renewalDate, new Date(q.to)));

      const rows = await tx.query.subscriptions.findMany({
        where: conditions.length ? and(...conditions) : sql`true`,
        orderBy: [asc(subscriptions.renewalDate)],
      });

      return rows.map((s) => ({
        id: s.id,
        tenantId: s.tenantId,
        subscriptionNumber: s.subscriptionNumber,
        commercialStatus: s.commercialStatus,
        renewalDate: s.renewalDate,
        autoRenew: s.autoRenew,
        effectivePriceCents: s.effectivePriceCents,
        billingFrequency: s.billingFrequency,
        currency: s.currency,
      }));
    });
  }
}
