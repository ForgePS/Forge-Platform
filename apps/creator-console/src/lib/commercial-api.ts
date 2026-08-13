import { apiGet, apiSend } from "@/lib/api";

export const COMMERCIAL_BACKEND_CONDITION =
  "CONDITION: Commercial backend is not deployed. Deploy the Subscription-S1 platform-api commercial module to enable this view.";

export function isNotFoundError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message;
  return /Request failed:\s*404\b|\b404\b|not\s*found/i.test(msg);
}

export function friendlyLoadError(err: unknown, subject = "this information"): string {
  if (isNotFoundError(err)) return COMMERCIAL_BACKEND_CONDITION;
  if (err instanceof Error && err.message.trim()) {
    const msg = err.message.trim();
    if (/failed to fetch|networkerror|load failed/i.test(msg)) {
      return `We couldn't load ${subject}. Check your connection and try again.`;
    }
    if (/^We couldn't load/i.test(msg)) return msg;
    return `We couldn't load ${subject}. ${msg}`;
  }
  return `We couldn't load ${subject}.`;
}

export type CommercialLoadState<T> =
  | { status: "loading" }
  | { status: "ok"; data: T }
  | { status: "unavailable" }
  | { status: "error"; message: string };

export type CommercialGetResult<T> =
  | { status: "ok"; data: T }
  | { status: "unavailable" }
  | { status: "error"; message: string };

export async function commercialGet<T>(
  path: string,
  options?: Parameters<typeof apiGet<T>>[1],
): Promise<CommercialGetResult<T>> {
  try {
    const data = await apiGet<T>(path, options);
    return { status: "ok", data };
  } catch (err) {
    if (isNotFoundError(err)) return { status: "unavailable" };
    return { status: "error", message: friendlyLoadError(err) };
  }
}

/** Normalize list payloads that may be a bare array or `{ items: T[] }`. */
export function unwrapItems<T>(payload: T[] | { items?: T[] } | null | undefined): T[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.items)) return payload.items;
  return [];
}

export type CommercialAnalyticsSummary = {
  arrCents?: number | null;
  mrrCents?: number | null;
  activeSubscriptionCount?: number | null;
  upcomingRenewalsCount?: number | null;
  outstandingBalanceCents?: number | null;
  pastDueCount?: number | null;
  renewals30d?: CommercialRenewalRow[] | null;
  pastDue?: CommercialAttentionRow[] | null;
  recentChanges?: CommercialChangeRow[] | null;
  needsAttention?: CommercialAttentionRow[] | null;
};

export type CommercialRenewalRow = {
  id: string;
  tenantId: string;
  tenantDisplayName?: string | null;
  subscriptionNumber?: string | null;
  planCode?: string | null;
  commercialStatus?: string | null;
  renewalDate?: string | null;
  effectivePriceCents?: number | null;
};

export type CommercialAttentionRow = {
  id: string;
  tenantId: string;
  tenantDisplayName?: string | null;
  subscriptionNumber?: string | null;
  commercialStatus?: string | null;
  reason?: string | null;
  balanceCents?: number | null;
  dueDate?: string | null;
};

export type CommercialChangeRow = {
  id: string;
  tenantId?: string | null;
  subscriptionId?: string | null;
  changeType?: string | null;
  summary?: string | null;
  effectiveAt?: string | null;
  createdAt?: string | null;
};

export type CommercialSubscriptionListItem = {
  id: string;
  tenantId: string;
  tenantDisplayName?: string | null;
  tenantSlug?: string | null;
  subscriptionNumber?: string | null;
  commercialStatus: string;
  status?: string | null;
  planCode?: string | null;
  planName?: string | null;
  billingFrequency?: string | null;
  effectivePriceCents?: number | null;
  catalogPriceCents?: number | null;
  discountCents?: number | null;
  implementationFeeCents?: number | null;
  currency?: string | null;
  renewalDate?: string | null;
  autoRenew?: boolean | null;
  currentPeriodEnd?: string | null;
  createdAt?: string | null;
};

export type CommercialSubscriptionItem = {
  id: string;
  itemType: string;
  productCode?: string | null;
  moduleCode?: string | null;
  description: string;
  quantity: number;
  unitPriceCents: number;
  amountCents: number;
  billingFrequency?: string | null;
  status?: string | null;
};

export type CommercialSubscriptionDetail = {
  id: string;
  tenantId: string;
  tenantDisplayName?: string | null;
  subscriptionNumber?: string | null;
  commercialStatus: string;
  status?: string | null;
  planId?: string | null;
  planCode?: string | null;
  planName?: string | null;
  planVersionId?: string | null;
  currency?: string | null;
  billingFrequency?: string | null;
  autoRenew?: boolean | null;
  contractStartDate?: string | null;
  renewalDate?: string | null;
  billingContactName?: string | null;
  billingContactEmail?: string | null;
  notes?: string | null;
  catalogPriceCents?: number | null;
  effectivePriceCents?: number | null;
  implementationFeeCents?: number | null;
  discountCents?: number | null;
  taxExempt?: boolean | null;
  taxNotes?: string | null;
  paymentTerms?: string | null;
  accessPolicy?: string | null;
  startsAt?: string | null;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  items?: CommercialSubscriptionItem[];
  balanceCents?: number | null;
  outstandingBalanceCents?: number | null;
  invoices?: CommercialInvoiceListItem[];
  payments?: CommercialPaymentListItem[];
  contract?: CommercialContractListItem | null;
  contracts?: CommercialContractListItem[];
  discounts?: CommercialDiscountListItem[];
  changes?: CommercialChangeRow[];
  recordVersion?: number;
};

export type CommercialPlan = {
  id: string;
  code: string;
  name: string;
  status: string;
  billingFrequency?: string | null;
  basePriceCents?: number | null;
  implementationFeeCents?: number | null;
  currency?: string | null;
  activeVersion?: {
    id: string;
    versionNumber: number;
    name: string;
    billingFrequency: string;
    basePriceCents: number;
    implementationFeeCents: number;
    currency: string;
    status: string;
  } | null;
  createdAt?: string | null;
};

export type CommercialInvoiceListItem = {
  id: string;
  tenantId: string;
  tenantDisplayName?: string | null;
  subscriptionId?: string | null;
  invoiceNumber: string;
  status: string;
  currency?: string | null;
  issueDate?: string | null;
  dueDate?: string | null;
  totalCents?: number | null;
  amountPaidCents?: number | null;
  balanceCents?: number | null;
  billingProvider?: string | null;
};

export type CommercialInvoiceDetail = CommercialInvoiceListItem & {
  subtotalCents?: number | null;
  discountCents?: number | null;
  taxCents?: number | null;
  creditCents?: number | null;
  notes?: string | null;
  billingContactName?: string | null;
  billingContactEmail?: string | null;
  paymentTerms?: string | null;
  lineItems?: Array<{
    id?: string;
    lineType: string;
    description: string;
    quantity: number;
    unitPriceCents: number;
    amountCents: number;
    periodStart?: string | null;
    periodEnd?: string | null;
    productCode?: string | null;
    moduleCode?: string | null;
  }>;
  recordVersion?: number;
};

export type CommercialPaymentListItem = {
  id: string;
  tenantId: string;
  tenantDisplayName?: string | null;
  paymentNumber: string;
  paymentDate: string;
  amountCents: number;
  currency?: string | null;
  method: string;
  reference?: string | null;
  notes?: string | null;
  billingProvider?: string | null;
};

export type CommercialDiscountListItem = {
  id: string;
  tenantId?: string | null;
  code: string;
  name: string;
  discountType: string;
  percentBps?: number | null;
  amountCents?: number | null;
  stackable?: boolean | null;
  startsAt?: string | null;
  endsAt?: string | null;
  status: string;
};

export type CommercialContractListItem = {
  id: string;
  tenantId: string;
  tenantDisplayName?: string | null;
  subscriptionId?: string | null;
  contractNumber: string;
  contractType?: string | null;
  status: string;
  title: string;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  notes?: string | null;
};

export const COMMERCIAL_PATHS = {
  analyticsSummary: "/api/v1/platform/commercial/analytics/summary",
  subscriptions: "/api/v1/platform/commercial/subscriptions",
  renewals: "/api/v1/platform/commercial/renewals",
  invoices: "/api/v1/platform/commercial/invoices",
  payments: "/api/v1/platform/commercial/payments",
  discounts: "/api/v1/platform/commercial/discounts",
  contracts: "/api/v1/platform/commercial/contracts",
  plans: "/api/v1/platform/plans",
  tenantSubscriptions: (tenantId: string) =>
    `/api/v1/tenants/${tenantId}/commercial/subscriptions`,
  tenantSubscription: (tenantId: string, id: string) =>
    `/api/v1/tenants/${tenantId}/commercial/subscriptions/${id}`,
  tenantSubscriptionChanges: (tenantId: string, id: string) =>
    `/api/v1/tenants/${tenantId}/commercial/subscriptions/${id}/changes`,
  tenantInvoices: (tenantId: string) => `/api/v1/tenants/${tenantId}/commercial/invoices`,
  tenantInvoice: (tenantId: string, id: string) =>
    `/api/v1/tenants/${tenantId}/commercial/invoices/${id}`,
  tenantPayments: (tenantId: string) => `/api/v1/tenants/${tenantId}/commercial/payments`,
} as const;

export async function commercialSend<T>(
  path: string,
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  payload?: unknown,
): Promise<{ ok: true; data: T } | { ok: false; message: string }> {
  try {
    const data = await apiSend<T>(path, method, payload);
    return { ok: true, data };
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error && err.message.trim()
          ? err.message.trim()
          : "We couldn't save those changes.",
    };
  }
}

export function subscriptionDetailHref(id: string, tenantId: string): string {
  const params = new URLSearchParams({ id, tenantId });
  return `/business/subscriptions/detail?${params.toString()}`;
}

export function invoiceDetailHref(id: string, tenantId: string): string {
  const params = new URLSearchParams({ id, tenantId });
  return `/business/invoices/detail?${params.toString()}`;
}
