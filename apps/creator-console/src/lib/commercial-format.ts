import {
  BILLING_FREQUENCIES,
  COMMERCIAL_SUBSCRIPTION_STATUSES,
  CONTRACT_STATUSES,
  INVOICE_STATUSES,
  PAYMENT_METHODS,
  PLAN_STATUSES,
  commercialStatusLabel,
  formatUsd as formatUsdCents,
  type BillingFrequency,
  type CommercialSubscriptionStatus,
  type ContractStatus,
  type InvoiceStatus,
  type PaymentMethod,
  type PlanStatus,
} from "@forge/contracts";

export { commercialStatusLabel };

const PLAN_STATUS_LABELS: Record<PlanStatus, string> = {
  DRAFT: "Draft",
  ACTIVE: "Active",
  RETIRED: "Retired",
};

const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: "Draft",
  OPEN: "Open",
  SENT: "Sent",
  PARTIALLY_PAID: "Partially paid",
  PAID: "Paid",
  PAST_DUE: "Past due",
  VOID: "Void",
};

const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  DRAFT: "Draft",
  PENDING_SIGNATURE: "Pending signature",
  ACTIVE: "Active",
  EXPIRED: "Expired",
  SUPERSEDED: "Superseded",
  CANCELLED: "Cancelled",
};

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  MANUAL: "Manual",
  ACH_EXTERNAL: "ACH (external)",
  CHECK: "Check",
  CARD_EXTERNAL: "Card (external)",
  WIRE: "Wire",
  OTHER: "Other",
};

const BILLING_FREQUENCY_LABELS: Record<BillingFrequency, string> = {
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  SEMI_ANNUAL: "Semi-annual",
  ANNUAL: "Annual",
  CUSTOM: "Custom",
};

function labelFromMap<T extends string>(
  value: string | null | undefined,
  map: Record<T, string>,
): string {
  if (!value) return "—";
  if (value in map) return map[value as T];
  return value;
}

/** Format integer cents as USD; returns "Not available" when missing or invalid. */
export function formatUsd(cents: number | null | undefined): string {
  if (cents == null || !Number.isFinite(cents)) return "Not available";
  try {
    return formatUsdCents(Math.trunc(cents));
  } catch {
    return "Not available";
  }
}

export function planStatusLabel(status: string | null | undefined): string {
  return labelFromMap(status, PLAN_STATUS_LABELS);
}

export function invoiceStatusLabel(status: string | null | undefined): string {
  return labelFromMap(status, INVOICE_STATUS_LABELS);
}

export function contractStatusLabel(status: string | null | undefined): string {
  return labelFromMap(status, CONTRACT_STATUS_LABELS);
}

export function paymentMethodLabel(method: string | null | undefined): string {
  return labelFromMap(method, PAYMENT_METHOD_LABELS);
}

export function billingFrequencyLabel(frequency: string | null | undefined): string {
  return labelFromMap(frequency, BILLING_FREQUENCY_LABELS);
}

export function isCommercialSubscriptionStatus(
  value: string,
): value is CommercialSubscriptionStatus {
  return (COMMERCIAL_SUBSCRIPTION_STATUSES as readonly string[]).includes(value);
}

export function isBillingFrequency(value: string): value is BillingFrequency {
  return (BILLING_FREQUENCIES as readonly string[]).includes(value);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const t = Date.parse(value);
  if (Number.isNaN(t)) return value;
  return new Date(t).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const t = Date.parse(value);
  if (Number.isNaN(t)) return value;
  return new Date(t).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function dollarsToCents(raw: string): number | null {
  const cleaned = raw.trim().replace(/[$,]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

export {
  BILLING_FREQUENCIES,
  COMMERCIAL_SUBSCRIPTION_STATUSES,
  CONTRACT_STATUSES,
  INVOICE_STATUSES,
  PAYMENT_METHODS,
  PLAN_STATUSES,
};
