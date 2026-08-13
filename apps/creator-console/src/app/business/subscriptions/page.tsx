"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import {
  CreatorLoading,
  CreatorPage,
  EmptyState,
  ErrorState,
  ForgePageSection,
  ForgeSkeleton,
  ForgeStatusBadge,
  ForgeToolbar,
} from "@/components/creator-page";
import { useAuth } from "@/hooks/use-auth";
import {
  COMMERCIAL_BACKEND_CONDITION,
  COMMERCIAL_PATHS,
  commercialGet,
  subscriptionDetailHref,
  unwrapItems,
  type CommercialSubscriptionListItem,
} from "@/lib/commercial-api";
import {
  COMMERCIAL_SUBSCRIPTION_STATUSES,
  billingFrequencyLabel,
  commercialStatusLabel,
  formatDate,
  formatUsd,
} from "@/lib/commercial-format";
import styles from "../../page.module.css";

function SubscriptionsInner() {
  const { hasPermission } = useAuth();
  const canView =
    hasPermission("platform.subscription.view") ||
    hasPermission("platform.billing.view") ||
    hasPermission("platform.entitlement.manage");

  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<CommercialSubscriptionListItem[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const load = useCallback(async () => {
    if (!canView) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setUnavailable(false);
    const result = await commercialGet<
      CommercialSubscriptionListItem[] | { items: CommercialSubscriptionListItem[] }
    >(COMMERCIAL_PATHS.subscriptions, {
      query: {
        status: statusFilter || undefined,
        search: search.trim() || undefined,
      },
    });
    if (result.status === "unavailable") {
      setUnavailable(true);
      setItems([]);
    } else if (result.status === "error") {
      setError(result.message);
      setItems([]);
    } else {
      setItems(unwrapItems(result.data));
    }
    setLoading(false);
  }, [canView, search, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((row) => {
      if (statusFilter && row.commercialStatus !== statusFilter) return false;
      if (!q) return true;
      const hay = [
        row.tenantDisplayName,
        row.subscriptionNumber,
        row.planCode,
        row.planName,
        row.commercialStatus,
        row.id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [items, search, statusFilter]);

  return (
    <CreatorPage
      title="Subscriptions"
      subtitle={
        <>
          <Link href="/business">Business</Link>
          {" · Commercial subscriptions across customers"}
        </>
      }
      width="wide"
    >
      {!canView ? (
        <p className={styles.error}>Missing permission: platform.subscription.view</p>
      ) : null}

      {canView ? (
        <ForgeToolbar
          actions={
            <button type="button" className="forge-btn forge-btn--secondary" onClick={() => void load()}>
              Refresh
            </button>
          }
        >
          <input
            className="forge-input"
            type="search"
            placeholder="Search customer, plan, number…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search subscriptions"
          />
          <select
            className="forge-select"
            aria-label="Status filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All statuses</option>
            {COMMERCIAL_SUBSCRIPTION_STATUSES.map((status) => (
              <option key={status} value={status}>
                {commercialStatusLabel(status)}
              </option>
            ))}
          </select>
        </ForgeToolbar>
      ) : null}

      {loading ? (
        <ForgePageSection title="Subscriptions">
          <ForgeSkeleton height="8rem" />
        </ForgePageSection>
      ) : null}

      {!loading && unavailable ? (
        <EmptyState
          title="Commercial API not available"
          description={COMMERCIAL_BACKEND_CONDITION}
        />
      ) : null}

      {!loading && error && !unavailable ? (
        <ErrorState title="We couldn't load this information." description={error} />
      ) : null}

      {!loading && !unavailable && !error && canView ? (
        <ForgePageSection title="All subscriptions">
          {filtered.length === 0 ? (
            <EmptyState
              title="No subscriptions found"
              description="Commercial subscriptions will appear here once created for customers."
            />
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Number</th>
                  <th>Plan</th>
                  <th>Status</th>
                  <th>Billing</th>
                  <th>Price</th>
                  <th>Renewal</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id}>
                    <td>{row.tenantDisplayName ?? row.tenantSlug ?? "—"}</td>
                    <td className={styles.mono}>{row.subscriptionNumber ?? "—"}</td>
                    <td>{row.planName ?? row.planCode ?? "—"}</td>
                    <td>
                      <ForgeStatusBadge
                        status={row.commercialStatus}
                        label={commercialStatusLabel(row.commercialStatus)}
                      />
                    </td>
                    <td>{billingFrequencyLabel(row.billingFrequency)}</td>
                    <td>{formatUsd(row.effectivePriceCents)}</td>
                    <td>{formatDate(row.renewalDate ?? row.currentPeriodEnd)}</td>
                    <td>
                      <details>
                        <summary>Actions</summary>
                        <div style={{ display: "grid", gap: "0.35rem", marginTop: "0.35rem" }}>
                          <Link href={subscriptionDetailHref(row.id, row.tenantId)}>
                            Open subscription
                          </Link>
                          <Link
                            href={`/business/invoices?tenantId=${encodeURIComponent(row.tenantId)}&subscriptionId=${encodeURIComponent(row.id)}`}
                          >
                            View invoices
                          </Link>
                          <Link
                            href={`/business/payments?tenantId=${encodeURIComponent(row.tenantId)}&subscriptionId=${encodeURIComponent(row.id)}`}
                          >
                            Record payment
                          </Link>
                        </div>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </ForgePageSection>
      ) : null}
    </CreatorPage>
  );
}

export default function BusinessSubscriptionsPage() {
  return (
    <Suspense fallback={<CreatorLoading />}>
      <SubscriptionsInner />
    </Suspense>
  );
}
