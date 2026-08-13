"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import {
  computeArrCents,
  computeMrrCents,
  type BillingFrequency,
} from "@forge/contracts";
import {
  CreatorLoading,
  CreatorPage,
  EmptyState,
  ErrorState,
  ForgeContextBar,
  ForgePageSection,
  ForgeSkeleton,
  ForgeStatusBadge,
  ForgeToolbar,
} from "@/components/creator-page";
import { useAuth } from "@/hooks/use-auth";
import { tenantDetailHref } from "@/hooks/use-tenant-id";
import {
  COMMERCIAL_BACKEND_CONDITION,
  COMMERCIAL_PATHS,
  commercialGet,
  commercialSend,
  invoiceDetailHref,
  unwrapItems,
  type CommercialChangeRow,
  type CommercialSubscriptionDetail,
} from "@/lib/commercial-api";
import {
  billingFrequencyLabel,
  commercialStatusLabel,
  formatDate,
  formatDateTime,
  formatUsd,
  isBillingFrequency,
  invoiceStatusLabel,
  paymentMethodLabel,
  contractStatusLabel,
} from "@/lib/commercial-format";
import styles from "../../../page.module.css";

type TabId =
  | "overview"
  | "products"
  | "pricing"
  | "invoices"
  | "payments"
  | "contract"
  | "renewal"
  | "activity";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "products", label: "Products & Modules" },
  { id: "pricing", label: "Pricing" },
  { id: "invoices", label: "Invoices" },
  { id: "payments", label: "Payments" },
  { id: "contract", label: "Contract" },
  { id: "renewal", label: "Renewal" },
  { id: "activity", label: "Activity" },
];

function DetailInner() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id")?.trim() ?? "";
  const tenantId = searchParams.get("tenantId")?.trim() ?? "";
  const { hasPermission } = useAuth();

  const canView =
    hasPermission("platform.subscription.view") ||
    hasPermission("platform.billing.view") ||
    hasPermission("platform.entitlement.manage");
  const canActivate = hasPermission("platform.subscription.activate");
  const canSuspend = hasPermission("platform.subscription.suspend");
  const canCancel = hasPermission("platform.subscription.cancel");
  const canRenew = hasPermission("platform.subscription.renew");
  const canInvoice = hasPermission("platform.invoice.create");
  const canPayment = hasPermission("platform.payment.record");

  const [tab, setTab] = useState<TabId>("overview");
  const [loading, setLoading] = useState(Boolean(id && tenantId));
  const [unavailable, setUnavailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [detail, setDetail] = useState<CommercialSubscriptionDetail | null>(null);
  const [changes, setChanges] = useState<CommercialChangeRow[]>([]);

  const load = useCallback(async () => {
    if (!id || !tenantId || !canView) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setUnavailable(false);
    const result = await commercialGet<CommercialSubscriptionDetail>(
      COMMERCIAL_PATHS.tenantSubscription(tenantId, id),
    );
    if (result.status === "unavailable") {
      setUnavailable(true);
      setDetail(null);
      setChanges([]);
    } else if (result.status === "error") {
      setError(result.message);
      setDetail(null);
      setChanges([]);
    } else {
      setDetail(result.data);
      if (result.data.changes?.length) {
        setChanges(result.data.changes);
      } else {
        const changeResult = await commercialGet<
          CommercialChangeRow[] | { items: CommercialChangeRow[] }
        >(COMMERCIAL_PATHS.tenantSubscriptionChanges(tenantId, id));
        if (changeResult.status === "ok") {
          setChanges(unwrapItems(changeResult.data));
        } else {
          setChanges([]);
        }
      }
    }
    setLoading(false);
  }, [canView, id, tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const runAction = useCallback(
    async (action: "activate" | "suspend" | "reactivate" | "cancel" | "renew") => {
      setActionError(null);
      setActionBusy(true);
      const body =
        action === "suspend"
          ? { reason: "Suspended from Creator Console" }
          : action === "cancel"
            ? {
                reason: "Cancelled from Creator Console",
                effectiveAt: new Date().toISOString(),
              }
            : undefined;
      const result = await commercialSend(
        `${COMMERCIAL_PATHS.tenantSubscription(tenantId, id)}/${action}`,
        "POST",
        body,
      );
      setActionBusy(false);
      if (!result.ok) {
        setActionError(result.message);
        return;
      }
      await load();
    },
    [id, load, tenantId],
  );

  const status = detail?.commercialStatus ?? "";

  const headerActions = useMemo(() => {
    if (!detail) {
      return [] as Array<{ key: string; label: string; href?: string; onClick?: () => void }>;
    }
    const actions: Array<{ key: string; label: string; href?: string; onClick?: () => void }> =
      [];

    if (
      canActivate &&
      (status === "DRAFT" || status === "PENDING_ACTIVATION" || status === "TRIAL")
    ) {
      actions.push({
        key: "activate",
        label: "Activate",
        onClick: () => void runAction("activate"),
      });
    }
    if (canSuspend && (status === "ACTIVE" || status === "PAST_DUE" || status === "TRIAL")) {
      actions.push({
        key: "suspend",
        label: "Suspend",
        onClick: () => void runAction("suspend"),
      });
    }
    if (canActivate && status === "SUSPENDED") {
      actions.push({
        key: "reactivate",
        label: "Reactivate",
        onClick: () => void runAction("reactivate"),
      });
    }
    if (
      canCancel &&
      status !== "CANCELLED" &&
      status !== "EXPIRED" &&
      status !== "CANCEL_SCHEDULED"
    ) {
      actions.push({
        key: "cancel",
        label: "Cancel",
        onClick: () => void runAction("cancel"),
      });
    }
    if (
      canRenew &&
      (status === "ACTIVE" || status === "PAST_DUE" || status === "CANCEL_SCHEDULED")
    ) {
      actions.push({
        key: "renew",
        label: "Renew",
        onClick: () => void runAction("renew"),
      });
    }
    if (canInvoice) {
      actions.push({
        key: "invoice",
        label: "Create invoice",
        href: `/business/invoices?tenantId=${encodeURIComponent(tenantId)}&subscriptionId=${encodeURIComponent(id)}&action=create`,
      });
    }
    if (canPayment) {
      actions.push({
        key: "payment",
        label: "Record payment",
        href: `/business/payments?tenantId=${encodeURIComponent(tenantId)}&subscriptionId=${encodeURIComponent(id)}`,
      });
    }

    return actions;
  }, [
    canActivate,
    canCancel,
    canInvoice,
    canPayment,
    canRenew,
    canSuspend,
    detail,
    id,
    runAction,
    status,
    tenantId,
  ]);

  const pricing = useMemo(() => {
    const catalog = detail?.catalogPriceCents ?? null;
    const discount = detail?.discountCents ?? 0;
    const implementation = detail?.implementationFeeCents ?? 0;
    const effective = detail?.effectivePriceCents ?? null;
    const freqRaw = detail?.billingFrequency ?? "ANNUAL";
    const frequency: BillingFrequency = isBillingFrequency(freqRaw) ? freqRaw : "ANNUAL";
    const recurring = effective ?? null;
    let arr: number | null = null;
    let mrr: number | null = null;
    if (recurring != null) {
      try {
        arr = computeArrCents(recurring, frequency);
        mrr = computeMrrCents(recurring, frequency);
      } catch {
        arr = null;
        mrr = null;
      }
    }
    const derived = catalog != null ? Math.max(0, catalog - (discount ?? 0)) : null;
    return { catalog, discount, implementation, effective, frequency, arr, mrr, derived };
  }, [detail]);

  if (!id || !tenantId) {
    return (
      <CreatorPage title="Subscription">
        <EmptyState
          title="Subscription not specified"
          description="Open a subscription from the list with both id and tenantId query parameters."
          action={
            <Link className="forge-btn forge-btn--outline" href="/business/subscriptions">
              Back to subscriptions
            </Link>
          }
        />
      </CreatorPage>
    );
  }

  return (
    <CreatorPage
      title={detail?.subscriptionNumber ?? "Subscription"}
      subtitle={
        <>
          <Link href="/business">Business</Link>
          {" · "}
          <Link href="/business/subscriptions">Subscriptions</Link>
          {" · "}
          <Link href={tenantDetailHref(tenantId)}>Customer</Link>
        </>
      }
      width="wide"
      actions={
        headerActions.length > 0 ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {headerActions.map((action) =>
              action.href ? (
                <Link
                  key={action.key}
                  className="forge-btn forge-btn--outline"
                  href={action.href}
                >
                  {action.label}
                </Link>
              ) : (
                <button
                  key={action.key}
                  type="button"
                  className="forge-btn forge-btn--secondary"
                  disabled={actionBusy}
                  onClick={action.onClick}
                >
                  {action.label}
                </button>
              ),
            )}
          </div>
        ) : undefined
      }
    >
      {loading ? <ForgeSkeleton height="4rem" /> : null}

      {!loading && unavailable ? (
        <EmptyState
          title="Commercial API not available"
          description={COMMERCIAL_BACKEND_CONDITION}
        />
      ) : null}

      {!loading && error && !unavailable ? (
        <ErrorState title="We couldn't load this information." description={error} />
      ) : null}

      {actionError ? <p className={styles.error}>{actionError}</p> : null}

      {!loading && detail ? (
        <>
          <ForgeContextBar
            title={detail.tenantDisplayName ?? "Customer"}
            status={
              <ForgeStatusBadge
                status={detail.commercialStatus}
                label={commercialStatusLabel(detail.commercialStatus)}
              />
            }
            subtitle={`${detail.planName ?? detail.planCode ?? "Plan"} · ${billingFrequencyLabel(detail.billingFrequency)}`}
            meta={
              <span>
                {formatUsd(detail.effectivePriceCents)} · Renewal{" "}
                {formatDate(detail.renewalDate ?? detail.currentPeriodEnd)}
              </span>
            }
            actions={
              <Link className="forge-btn forge-btn--outline" href={tenantDetailHref(tenantId)}>
                Open customer
              </Link>
            }
          />

          <ForgeToolbar>
            <nav className={styles.linkRow} aria-label="Subscription sections">
              {TABS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={
                    tab === item.id
                      ? "forge-btn forge-btn--primary"
                      : "forge-btn forge-btn--outline"
                  }
                  onClick={() => setTab(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </ForgeToolbar>

          {tab === "overview" ? (
            <ForgePageSection title="Overview">
              <dl className={styles.dl}>
                <dt>Subscription number</dt>
                <dd className={styles.mono}>{detail.subscriptionNumber ?? "—"}</dd>
                <dt>Commercial status</dt>
                <dd>
                  <ForgeStatusBadge
                    status={detail.commercialStatus}
                    label={commercialStatusLabel(detail.commercialStatus)}
                  />
                </dd>
                <dt>Plan</dt>
                <dd>{detail.planName ?? detail.planCode ?? "—"}</dd>
                <dt>Billing frequency</dt>
                <dd>{billingFrequencyLabel(detail.billingFrequency)}</dd>
                <dt>Auto renew</dt>
                <dd>{detail.autoRenew == null ? "—" : detail.autoRenew ? "Yes" : "No"}</dd>
                <dt>Payment terms</dt>
                <dd>{detail.paymentTerms ?? "—"}</dd>
                <dt>Access policy</dt>
                <dd>{detail.accessPolicy ?? "—"}</dd>
                <dt>Billing contact</dt>
                <dd>
                  {detail.billingContactName ?? "—"}
                  {detail.billingContactEmail ? ` · ${detail.billingContactEmail}` : ""}
                </dd>
                <dt>Period</dt>
                <dd>
                  {formatDate(detail.currentPeriodStart)} – {formatDate(detail.currentPeriodEnd)}
                </dd>
                <dt>Outstanding balance</dt>
                <dd>{formatUsd(detail.outstandingBalanceCents ?? detail.balanceCents)}</dd>
                <dt>Notes</dt>
                <dd>{detail.notes ?? "—"}</dd>
              </dl>
            </ForgePageSection>
          ) : null}

          {tab === "products" ? (
            <ForgePageSection title="Products & Modules">
              {!detail.items?.length ? (
                <EmptyState
                  title="No subscription items"
                  description="Products and modules on this subscription will appear here."
                />
              ) : (
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Description</th>
                      <th>Product</th>
                      <th>Module</th>
                      <th>Qty</th>
                      <th>Unit</th>
                      <th>Amount</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.items.map((item) => (
                      <tr key={item.id}>
                        <td>{item.itemType}</td>
                        <td>{item.description}</td>
                        <td>{item.productCode ?? "—"}</td>
                        <td>{item.moduleCode ?? "—"}</td>
                        <td>{item.quantity}</td>
                        <td>{formatUsd(item.unitPriceCents)}</td>
                        <td>{formatUsd(item.amountCents)}</td>
                        <td>{item.status ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </ForgePageSection>
          ) : null}

          {tab === "pricing" ? (
            <ForgePageSection title="Pricing">
              <p className={styles.muted}>
                Transparent calculation from stored commercial fields (integer cents). No estimated
                figures.
              </p>
              <dl className={styles.dl}>
                <dt>Catalog price</dt>
                <dd>{formatUsd(pricing.catalog)}</dd>
                <dt>Discount</dt>
                <dd>{formatUsd(pricing.discount)}</dd>
                <dt>Catalog − discount</dt>
                <dd>{formatUsd(pricing.derived)}</dd>
                <dt>Implementation fee</dt>
                <dd>{formatUsd(pricing.implementation)}</dd>
                <dt>Effective recurring price</dt>
                <dd>{formatUsd(pricing.effective)}</dd>
                <dt>Billing frequency</dt>
                <dd>{billingFrequencyLabel(pricing.frequency)}</dd>
                <dt>ARR (from effective × frequency)</dt>
                <dd>{formatUsd(pricing.arr)}</dd>
                <dt>MRR (from effective ÷ frequency)</dt>
                <dd>{formatUsd(pricing.mrr)}</dd>
                <dt>Currency</dt>
                <dd>{detail.currency ?? "USD"}</dd>
                <dt>Tax exempt</dt>
                <dd>
                  {detail.taxExempt == null ? "—" : detail.taxExempt ? "Yes" : "No"}
                  {detail.taxNotes ? ` · ${detail.taxNotes}` : ""}
                </dd>
              </dl>
            </ForgePageSection>
          ) : null}

          {tab === "invoices" ? (
            <ForgePageSection title="Invoices">
              {!detail.invoices?.length ? (
                <EmptyState
                  title="No invoices"
                  description="Invoices linked to this subscription will appear here."
                  action={
                    canInvoice ? (
                      <Link
                        className="forge-btn forge-btn--outline"
                        href={`/business/invoices?tenantId=${encodeURIComponent(tenantId)}&subscriptionId=${encodeURIComponent(id)}`}
                      >
                        Go to invoices
                      </Link>
                    ) : undefined
                  }
                />
              ) : (
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Number</th>
                      <th>Status</th>
                      <th>Issued</th>
                      <th>Due</th>
                      <th>Total</th>
                      <th>Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.invoices.map((inv) => (
                      <tr key={inv.id}>
                        <td>
                          <Link href={invoiceDetailHref(inv.id, inv.tenantId)}>
                            {inv.invoiceNumber}
                          </Link>
                        </td>
                        <td>
                          <ForgeStatusBadge
                            status={inv.status}
                            label={invoiceStatusLabel(inv.status)}
                          />
                        </td>
                        <td>{formatDate(inv.issueDate)}</td>
                        <td>{formatDate(inv.dueDate)}</td>
                        <td>{formatUsd(inv.totalCents)}</td>
                        <td>{formatUsd(inv.balanceCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </ForgePageSection>
          ) : null}

          {tab === "payments" ? (
            <ForgePageSection title="Payments">
              {!detail.payments?.length ? (
                <EmptyState
                  title="No payments recorded"
                  description="Manual payments allocated to this customer will appear here."
                  action={
                    canPayment ? (
                      <Link
                        className="forge-btn forge-btn--outline"
                        href={`/business/payments?tenantId=${encodeURIComponent(tenantId)}&subscriptionId=${encodeURIComponent(id)}`}
                      >
                        Record payment
                      </Link>
                    ) : undefined
                  }
                />
              ) : (
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Number</th>
                      <th>Date</th>
                      <th>Method</th>
                      <th>Amount</th>
                      <th>Reference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.payments.map((pay) => (
                      <tr key={pay.id}>
                        <td className={styles.mono}>{pay.paymentNumber}</td>
                        <td>{formatDate(pay.paymentDate)}</td>
                        <td>{paymentMethodLabel(pay.method)}</td>
                        <td>{formatUsd(pay.amountCents)}</td>
                        <td>{pay.reference ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </ForgePageSection>
          ) : null}

          {tab === "contract" ? (
            <ForgePageSection title="Contract">
              {(() => {
                const contracts =
                  detail.contracts ?? (detail.contract ? [detail.contract] : []);
                if (!contracts.length) {
                  return (
                    <EmptyState
                      title="No contract on file"
                      description="Contract metadata (no e-sign) will appear here when linked."
                      action={
                        <Link className="forge-btn forge-btn--outline" href="/business/contracts">
                          Contracts
                        </Link>
                      }
                    />
                  );
                }
                return (
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Number</th>
                        <th>Title</th>
                        <th>Type</th>
                        <th>Status</th>
                        <th>Effective</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contracts.map((c) => (
                        <tr key={c.id}>
                          <td className={styles.mono}>{c.contractNumber}</td>
                          <td>{c.title}</td>
                          <td>{c.contractType ?? "—"}</td>
                          <td>
                            <ForgeStatusBadge
                              status={c.status}
                              label={contractStatusLabel(c.status)}
                            />
                          </td>
                          <td>
                            {formatDate(c.effectiveFrom)} – {formatDate(c.effectiveTo)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              })()}
            </ForgePageSection>
          ) : null}

          {tab === "renewal" ? (
            <ForgePageSection title="Renewal">
              <dl className={styles.dl}>
                <dt>Contract start</dt>
                <dd>{formatDate(detail.contractStartDate)}</dd>
                <dt>Renewal date</dt>
                <dd>{formatDate(detail.renewalDate)}</dd>
                <dt>Current period end</dt>
                <dd>{formatDate(detail.currentPeriodEnd)}</dd>
                <dt>Auto renew</dt>
                <dd>{detail.autoRenew == null ? "—" : detail.autoRenew ? "Yes" : "No"}</dd>
              </dl>
            </ForgePageSection>
          ) : null}

          {tab === "activity" ? (
            <ForgePageSection title="Activity">
              {changes.length === 0 ? (
                <EmptyState
                  title="No activity yet"
                  description="Subscription changes and events will appear here."
                />
              ) : (
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Type</th>
                      <th>Summary</th>
                    </tr>
                  </thead>
                  <tbody>
                    {changes.map((row) => (
                      <tr key={row.id}>
                        <td>{formatDateTime(row.effectiveAt ?? row.createdAt)}</td>
                        <td>{row.changeType ?? "—"}</td>
                        <td>{row.summary ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </ForgePageSection>
          ) : null}
        </>
      ) : null}
    </CreatorPage>
  );
}

export default function BusinessSubscriptionDetailPage() {
  return (
    <Suspense fallback={<CreatorLoading />}>
      <DetailInner />
    </Suspense>
  );
}
