import { z } from "zod";

// ---------------------------------------------------------------------------
// Subscription commercial statuses (Subscription-S1)
// ---------------------------------------------------------------------------

export const COMMERCIAL_SUBSCRIPTION_STATUSES = [
  "DRAFT",
  "TRIAL",
  "PENDING_ACTIVATION",
  "ACTIVE",
  "PAST_DUE",
  "SUSPENDED",
  "CANCEL_SCHEDULED",
  "CANCELLED",
  "EXPIRED",
] as const;

export type CommercialSubscriptionStatus = (typeof COMMERCIAL_SUBSCRIPTION_STATUSES)[number];

const COMMERCIAL_STATUS_LABELS: Record<CommercialSubscriptionStatus, string> = {
  DRAFT: "Draft",
  TRIAL: "Trial",
  PENDING_ACTIVATION: "Pending activation",
  ACTIVE: "Active",
  PAST_DUE: "Past due",
  SUSPENDED: "Suspended",
  CANCEL_SCHEDULED: "Cancel scheduled",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
};

export function commercialStatusLabel(status: CommercialSubscriptionStatus | string): string {
  if (status in COMMERCIAL_STATUS_LABELS) {
    return COMMERCIAL_STATUS_LABELS[status as CommercialSubscriptionStatus];
  }
  return status;
}

export const BILLING_FREQUENCIES = [
  "MONTHLY",
  "QUARTERLY",
  "SEMI_ANNUAL",
  "ANNUAL",
  "CUSTOM",
] as const;

export type BillingFrequency = (typeof BILLING_FREQUENCIES)[number];

export const PLAN_STATUSES = ["DRAFT", "ACTIVE", "RETIRED"] as const;

export type PlanStatus = (typeof PLAN_STATUSES)[number];

export const INVOICE_STATUSES = [
  "DRAFT",
  "OPEN",
  "SENT",
  "PARTIALLY_PAID",
  "PAID",
  "PAST_DUE",
  "VOID",
] as const;

export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const PAYMENT_METHODS = [
  "MANUAL",
  "ACH_EXTERNAL",
  "CHECK",
  "CARD_EXTERNAL",
  "WIRE",
  "OTHER",
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const CONTRACT_STATUSES = [
  "DRAFT",
  "PENDING_SIGNATURE",
  "ACTIVE",
  "EXPIRED",
  "SUPERSEDED",
  "CANCELLED",
] as const;

export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

export const SUBSCRIPTION_ITEM_TYPES = [
  "PRODUCT",
  "MODULE",
  "IMPLEMENTATION",
  "ADDON",
  "CUSTOM",
] as const;

export type SubscriptionItemType = (typeof SUBSCRIPTION_ITEM_TYPES)[number];

export const DISCOUNT_TYPES = ["PERCENT", "FIXED"] as const;

export type DiscountType = (typeof DISCOUNT_TYPES)[number];

export const ACCESS_POLICIES = [
  "FULL_ACCESS",
  "WRITE_RESTRICTED",
  "READ_ONLY",
  "SUSPENDED",
] as const;

export type AccessPolicy = (typeof ACCESS_POLICIES)[number];

export const PRORATION_METHODS = ["DAILY", "NONE", "NEXT_CYCLE"] as const;

export type ProrationMethod = (typeof PRORATION_METHODS)[number];

export const COMMERCIAL_SEQUENCE_KEYS = [
  "INVOICE",
  "PAYMENT",
  "SUBSCRIPTION",
  "CREDIT",
  "CONTRACT",
] as const;

export type CommercialSequenceKey = (typeof COMMERCIAL_SEQUENCE_KEYS)[number];

// ---------------------------------------------------------------------------
// Permissions
// ---------------------------------------------------------------------------

export const COMMERCIAL_PERMISSIONS = [
  "platform.subscription.view",
  "platform.subscription.create",
  "platform.subscription.update",
  "platform.subscription.activate",
  "platform.subscription.suspend",
  "platform.subscription.cancel",
  "platform.subscription.renew",
  "platform.plan.view",
  "platform.plan.manage",
  "platform.billing.view",
  "platform.invoice.create",
  "platform.invoice.update",
  "platform.invoice.void",
  "platform.payment.view",
  "platform.payment.record",
  "platform.discount.manage",
  "platform.credit.manage",
  "platform.contract.view",
  "platform.contract.manage",
  "platform.revenue.view",
] as const;

export type CommercialPermission = (typeof COMMERCIAL_PERMISSIONS)[number];

/** Billing manage permissions reserved for creator / platform principals. */
export const COMMERCIAL_CREATOR_ONLY_PERMISSIONS = [
  "platform.plan.manage",
  "platform.invoice.void",
  "platform.payment.record",
  "platform.discount.manage",
  "platform.credit.manage",
  "platform.revenue.view",
  "platform.subscription.activate",
  "platform.subscription.suspend",
  "platform.subscription.cancel",
] as const satisfies readonly CommercialPermission[];

// ---------------------------------------------------------------------------
// Money helpers (integer cents; round half-up where division is required)
// ---------------------------------------------------------------------------

export type MoneyCents = number;

export function assertNonNegativeCents(value: MoneyCents, label = "amount"): asserts value is MoneyCents {
  if (!Number.isInteger(value)) {
    throw new Error(`${label} must be an integer number of cents`);
  }
  if (value < 0) {
    throw new Error(`${label} must be non-negative`);
  }
}

/** Round half-up division for non-negative integers: floor((n + d/2) / d). */
export function divideCentsHalfUp(numerator: number, denominator: number): MoneyCents {
  if (!Number.isInteger(numerator) || !Number.isInteger(denominator)) {
    throw new Error("divideCentsHalfUp requires integer arguments");
  }
  if (denominator <= 0) {
    throw new Error("denominator must be positive");
  }
  if (numerator < 0) {
    throw new Error("numerator must be non-negative");
  }
  return Math.floor((numerator + Math.floor(denominator / 2)) / denominator);
}

export function formatUsd(cents: MoneyCents): string {
  assertNonNegativeCents(cents, "cents");
  const dollars = Math.floor(cents / 100);
  const remainder = cents % 100;
  return `$${dollars.toLocaleString("en-US")}.${remainder.toString().padStart(2, "0")}`;
}

export function addCents(a: MoneyCents, b: MoneyCents): MoneyCents {
  assertNonNegativeCents(a, "a");
  assertNonNegativeCents(b, "b");
  return a + b;
}

export function subtractCents(a: MoneyCents, b: MoneyCents): MoneyCents {
  assertNonNegativeCents(a, "a");
  assertNonNegativeCents(b, "b");
  if (b > a) {
    throw new Error("subtractCents result would be negative");
  }
  return a - b;
}

/** `percentBps` is basis points (10_000 = 100%). */
export function percentOfCents(cents: MoneyCents, percentBps: number): MoneyCents {
  assertNonNegativeCents(cents, "cents");
  if (!Number.isInteger(percentBps) || percentBps < 0) {
    throw new Error("percentBps must be a non-negative integer");
  }
  return divideCentsHalfUp(cents * percentBps, 10_000);
}

export function computeArrCents(
  recurringCents: MoneyCents,
  frequency: BillingFrequency,
): MoneyCents {
  assertNonNegativeCents(recurringCents, "recurringCents");
  switch (frequency) {
    case "MONTHLY":
      return recurringCents * 12;
    case "QUARTERLY":
      return recurringCents * 4;
    case "SEMI_ANNUAL":
      return recurringCents * 2;
    case "ANNUAL":
    case "CUSTOM":
      return recurringCents;
    default: {
      const _exhaustive: never = frequency;
      return _exhaustive;
    }
  }
}

export function computeMrrCents(
  recurringCents: MoneyCents,
  frequency: BillingFrequency,
): MoneyCents {
  assertNonNegativeCents(recurringCents, "recurringCents");
  switch (frequency) {
    case "MONTHLY":
      return recurringCents;
    case "QUARTERLY":
      return divideCentsHalfUp(recurringCents, 3);
    case "SEMI_ANNUAL":
      return divideCentsHalfUp(recurringCents, 6);
    case "ANNUAL":
    case "CUSTOM":
      return divideCentsHalfUp(recurringCents, 12);
    default: {
      const _exhaustive: never = frequency;
      return _exhaustive;
    }
  }
}

function toUtcDateOnly(value: Date | string): Date {
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) {
    throw new Error("invalid date");
  }
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Whole UTC calendar days from start (inclusive) to end (exclusive). */
export function utcDaySpan(start: Date | string, end: Date | string): number {
  const a = toUtcDateOnly(start).getTime();
  const b = toUtcDateOnly(end).getTime();
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

export type ProrateCentsInput = {
  amountCents: MoneyCents;
  periodStart: Date | string;
  periodEnd: Date | string;
  effectiveFrom: Date | string;
  method: ProrationMethod;
};

/**
 * Prorate a period charge.
 * - NONE: full amount
 * - NEXT_CYCLE: zero (bill starts next cycle)
 * - DAILY: remaining days / total days, round half-up
 */
export function prorateCents(input: ProrateCentsInput): MoneyCents {
  const { amountCents, method } = input;
  assertNonNegativeCents(amountCents, "amountCents");

  if (method === "NONE") {
    return amountCents;
  }
  if (method === "NEXT_CYCLE") {
    return 0;
  }

  const periodStart = toUtcDateOnly(input.periodStart);
  const periodEnd = toUtcDateOnly(input.periodEnd);
  const effectiveFrom = toUtcDateOnly(input.effectiveFrom);

  const totalDays = utcDaySpan(periodStart, periodEnd);
  if (totalDays <= 0) {
    return 0;
  }

  const start = effectiveFrom.getTime() > periodStart.getTime() ? effectiveFrom : periodStart;
  if (start.getTime() >= periodEnd.getTime()) {
    return 0;
  }

  const remainingDays = utcDaySpan(start, periodEnd);
  return divideCentsHalfUp(amountCents * remainingDays, totalDays);
}

// ---------------------------------------------------------------------------
// Zod create / mutation inputs
// ---------------------------------------------------------------------------

const moneyCentsSchema = z.number().int().nonnegative();

export const createPlanInputSchema = z.object({
  code: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[A-Z0-9][A-Z0-9_]*$/),
  name: z.string().min(1).max(200),
  billingFrequency: z.enum(BILLING_FREQUENCIES),
  basePriceCents: moneyCentsSchema,
  implementationFeeCents: moneyCentsSchema.default(0),
  currency: z.string().length(3).default("USD"),
  status: z.enum(PLAN_STATUSES).default("DRAFT"),
  configurationJson: z
    .object({
      includedModules: z.array(z.string().min(1).max(64)).default([]),
      optionalModules: z.array(z.string().min(1).max(64)).default([]),
      limits: z.record(z.unknown()).default({}),
    })
    .default({}),
  effectiveFrom: z.string().datetime().optional(),
});

export type CreatePlanInput = z.infer<typeof createPlanInputSchema>;

export const createSubscriptionCommercialInputSchema = z.object({
  tenantId: z.string().uuid(),
  planId: z.string().uuid(),
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
  catalogPriceCents: moneyCentsSchema.optional(),
  effectivePriceCents: moneyCentsSchema.optional(),
  implementationFeeCents: moneyCentsSchema.optional(),
  discountCents: moneyCentsSchema.optional(),
  taxExempt: z.boolean().default(false),
  taxNotes: z.string().max(2000).optional(),
  paymentTerms: z.string().max(64).default("NET_30"),
  accessPolicy: z.enum(ACCESS_POLICIES).default("FULL_ACCESS"),
  startsAt: z.string().datetime(),
  currentPeriodStart: z.string().datetime(),
  currentPeriodEnd: z.string().datetime(),
});

export type CreateSubscriptionCommercialInput = z.infer<
  typeof createSubscriptionCommercialInputSchema
>;

export const createInvoiceInputSchema = z.object({
  tenantId: z.string().uuid(),
  subscriptionId: z.string().uuid().optional(),
  currency: z.string().length(3).default("USD"),
  issueDate: z.string().datetime(),
  dueDate: z.string().datetime(),
  subtotalCents: moneyCentsSchema,
  discountCents: moneyCentsSchema.default(0),
  taxCents: moneyCentsSchema.default(0),
  creditCents: moneyCentsSchema.default(0),
  notes: z.string().max(4000).optional(),
  lineItems: z
    .array(
      z.object({
        lineType: z.string().min(1).max(64),
        description: z.string().min(1).max(500),
        quantity: z.number().int().positive().default(1),
        unitPriceCents: moneyCentsSchema,
        amountCents: moneyCentsSchema,
        periodStart: z.string().datetime().optional(),
        periodEnd: z.string().datetime().optional(),
        productCode: z.string().max(64).optional(),
        moduleCode: z.string().max(64).optional(),
      }),
    )
    .default([]),
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceInputSchema>;

export const recordPaymentInputSchema = z.object({
  tenantId: z.string().uuid(),
  paymentDate: z.string().datetime(),
  amountCents: moneyCentsSchema.positive(),
  currency: z.string().length(3).default("USD"),
  method: z.enum(PAYMENT_METHODS).default("MANUAL"),
  reference: z.string().max(255).optional(),
  notes: z.string().max(4000).optional(),
  allocations: z
    .array(
      z.object({
        invoiceId: z.string().uuid(),
        amountCents: moneyCentsSchema.positive(),
      }),
    )
    .default([]),
});

export type RecordPaymentInput = z.infer<typeof recordPaymentInputSchema>;

export const applyCreditInputSchema = z.object({
  tenantId: z.string().uuid(),
  reason: z.string().min(1).max(500),
  amountCents: moneyCentsSchema.positive(),
  expiresAt: z.string().datetime().optional(),
  notes: z.string().max(4000).optional(),
});

export type ApplyCreditInput = z.infer<typeof applyCreditInputSchema>;

export const createDiscountInputSchema = z.object({
  tenantId: z.string().uuid().nullable().optional(),
  code: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[A-Z0-9][A-Z0-9_-]*$/),
  name: z.string().min(1).max(200),
  discountType: z.enum(DISCOUNT_TYPES),
  percentBps: z.number().int().min(0).max(10_000).optional(),
  amountCents: moneyCentsSchema.optional(),
  stackable: z.boolean().default(false),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "RETIRED"]).default("ACTIVE"),
  configurationJson: z.record(z.unknown()).default({}),
});

export type CreateDiscountInput = z.infer<typeof createDiscountInputSchema>;
