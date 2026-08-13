/**
 * Commercial money / lifecycle helpers for Subscription-S1.
 * Prefer @forge/contracts primitives; add service-layer pure helpers here.
 */
export {
  type MoneyCents,
  type BillingFrequency,
  type ProrationMethod,
  type AccessPolicy,
  type CommercialSubscriptionStatus,
  type InvoiceStatus,
  assertNonNegativeCents,
  divideCentsHalfUp,
  formatUsd,
  addCents,
  subtractCents,
  percentOfCents,
  computeArrCents,
  computeMrrCents,
  utcDaySpan,
  prorateCents,
  COMMERCIAL_SUBSCRIPTION_STATUSES,
  INVOICE_STATUSES,
} from "@forge/contracts";

import type {
  AccessPolicy,
  BillingFrequency,
  CommercialSubscriptionStatus,
  InvoiceStatus,
  MoneyCents,
} from "@forge/contracts";
import {
  addCents,
  assertNonNegativeCents,
  computeArrCents,
  computeMrrCents,
  subtractCents,
} from "@forge/contracts";
import { ForgeError } from "@forge/errors";

/** Allowed commercialStatus transitions (Subscription-S1). */
export const COMMERCIAL_STATUS_TRANSITIONS: Record<
  CommercialSubscriptionStatus,
  readonly CommercialSubscriptionStatus[]
> = {
  DRAFT: ["TRIAL", "PENDING_ACTIVATION", "ACTIVE", "CANCELLED"],
  TRIAL: ["ACTIVE", "PENDING_ACTIVATION", "SUSPENDED", "CANCELLED", "EXPIRED"],
  PENDING_ACTIVATION: ["ACTIVE", "CANCELLED", "SUSPENDED"],
  ACTIVE: ["PAST_DUE", "SUSPENDED", "CANCEL_SCHEDULED", "CANCELLED", "EXPIRED"],
  PAST_DUE: ["ACTIVE", "SUSPENDED", "CANCEL_SCHEDULED", "CANCELLED"],
  SUSPENDED: ["ACTIVE", "CANCELLED", "EXPIRED"],
  CANCEL_SCHEDULED: ["CANCELLED", "ACTIVE"],
  CANCELLED: [],
  EXPIRED: [],
};

export function assertCommercialTransition(
  from: CommercialSubscriptionStatus | string,
  to: CommercialSubscriptionStatus | string,
): void {
  const allowed = COMMERCIAL_STATUS_TRANSITIONS[from as CommercialSubscriptionStatus];
  if (!allowed || !allowed.includes(to as CommercialSubscriptionStatus)) {
    throw new ForgeError(
      "VALIDATION_FAILED",
      `Invalid commercial status transition ${from} → ${to}`,
    );
  }
}

export type InvoiceTotalsInput = {
  subtotalCents: MoneyCents;
  discountCents?: MoneyCents;
  taxCents?: MoneyCents;
  creditCents?: MoneyCents;
  amountPaidCents?: MoneyCents;
};

export type InvoiceTotals = {
  subtotalCents: MoneyCents;
  discountCents: MoneyCents;
  taxCents: MoneyCents;
  creditCents: MoneyCents;
  totalCents: MoneyCents;
  amountPaidCents: MoneyCents;
  balanceCents: MoneyCents;
  status: InvoiceStatus;
};

/**
 * Recalculate invoice totals in integer cents.
 * total = subtotal - discount + tax - credit (floored at 0).
 * balance = total - amountPaid (floored at 0).
 */
export function recalculateInvoiceTotals(input: InvoiceTotalsInput): InvoiceTotals {
  const subtotalCents = input.subtotalCents;
  const discountCents = input.discountCents ?? 0;
  const taxCents = input.taxCents ?? 0;
  const creditCents = input.creditCents ?? 0;
  const amountPaidCents = input.amountPaidCents ?? 0;

  assertNonNegativeCents(subtotalCents, "subtotalCents");
  assertNonNegativeCents(discountCents, "discountCents");
  assertNonNegativeCents(taxCents, "taxCents");
  assertNonNegativeCents(creditCents, "creditCents");
  assertNonNegativeCents(amountPaidCents, "amountPaidCents");

  const afterDiscount = Math.max(0, subtotalCents - discountCents);
  const totalCents = Math.max(0, afterDiscount + taxCents - creditCents);
  const balanceCents = Math.max(0, totalCents - amountPaidCents);

  let status: InvoiceStatus = "OPEN";
  if (totalCents === 0 && amountPaidCents === 0) {
    status = "PAID";
  } else if (balanceCents === 0 && amountPaidCents > 0) {
    status = "PAID";
  } else if (amountPaidCents > 0 && balanceCents > 0) {
    status = "PARTIALLY_PAID";
  } else {
    status = "OPEN";
  }

  return {
    subtotalCents,
    discountCents,
    taxCents,
    creditCents,
    totalCents,
    amountPaidCents,
    balanceCents,
    status,
  };
}

export type AllocationLine = { invoiceId: string; amountCents: MoneyCents };

/**
 * Validate payment allocations: sum must equal payment amount; each line positive.
 */
export function assertPaymentAllocations(
  paymentAmountCents: MoneyCents,
  allocations: AllocationLine[],
): void {
  assertNonNegativeCents(paymentAmountCents, "paymentAmountCents");
  if (paymentAmountCents <= 0) {
    throw new ForgeError("VALIDATION_FAILED", "payment amount must be positive");
  }
  let sum = 0;
  for (const line of allocations) {
    assertNonNegativeCents(line.amountCents, "allocation.amountCents");
    if (line.amountCents <= 0) {
      throw new ForgeError("VALIDATION_FAILED", "allocation amount must be positive");
    }
    sum = addCents(sum, line.amountCents);
  }
  if (sum !== paymentAmountCents) {
    throw new ForgeError(
      "VALIDATION_FAILED",
      `allocation sum ${sum} must equal payment amount ${paymentAmountCents}`,
    );
  }
}

/** Apply a payment allocation to an invoice's paid/balance figures. */
export function applyAllocationToInvoice(params: {
  totalCents: MoneyCents;
  amountPaidCents: MoneyCents;
  allocationCents: MoneyCents;
}): { amountPaidCents: MoneyCents; balanceCents: MoneyCents; status: InvoiceStatus } {
  const { totalCents, amountPaidCents, allocationCents } = params;
  assertNonNegativeCents(totalCents, "totalCents");
  assertNonNegativeCents(amountPaidCents, "amountPaidCents");
  assertNonNegativeCents(allocationCents, "allocationCents");

  const remaining = subtractCents(totalCents, amountPaidCents);
  if (allocationCents > remaining) {
    throw new ForgeError(
      "VALIDATION_FAILED",
      `allocation ${allocationCents} exceeds invoice balance ${remaining}`,
    );
  }
  const nextPaid = addCents(amountPaidCents, allocationCents);
  const balanceCents = subtractCents(totalCents, nextPaid);
  let status: InvoiceStatus = "OPEN";
  if (balanceCents === 0) status = "PAID";
  else if (nextPaid > 0) status = "PARTIALLY_PAID";
  return { amountPaidCents: nextPaid, balanceCents, status };
}

export type RecurringLine = {
  amountCents: MoneyCents;
  billingFrequency: BillingFrequency;
};

/** Sum ARR/MRR from active recurring lines. */
export function summarizeRecurringRevenue(lines: RecurringLine[]): {
  arrCents: MoneyCents;
  mrrCents: MoneyCents;
} {
  let arrCents = 0;
  let mrrCents = 0;
  for (const line of lines) {
    arrCents = addCents(arrCents, computeArrCents(line.amountCents, line.billingFrequency));
    mrrCents = addCents(mrrCents, computeMrrCents(line.amountCents, line.billingFrequency));
  }
  return { arrCents, mrrCents };
}

/**
 * Suspend access behavior by accessPolicy (documented):
 * - FULL_ACCESS: no entitlement change on soft suspend path (caller still syncs)
 * - WRITE_RESTRICTED / READ_ONLY: keep module status ACTIVE; set configurationJson.accessPolicy
 * - SUSPENDED: set module status GRACE (time-boxed) with configurationJson.accessPolicy = SUSPENDED
 */
export function entitlementStatusForAccessPolicy(policy: AccessPolicy): {
  moduleStatus: "ACTIVE" | "GRACE" | "SUSPENDED";
  accessFlag: AccessPolicy;
} {
  switch (policy) {
    case "SUSPENDED":
      return { moduleStatus: "GRACE", accessFlag: "SUSPENDED" };
    case "WRITE_RESTRICTED":
    case "READ_ONLY":
      return { moduleStatus: "ACTIVE", accessFlag: policy };
    case "FULL_ACCESS":
    default:
      return { moduleStatus: "ACTIVE", accessFlag: "FULL_ACCESS" };
  }
}

export function padSeq(n: number, width = 7): string {
  return String(n).padStart(width, "0");
}
