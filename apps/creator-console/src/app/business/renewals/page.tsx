"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
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
  type CommercialRenewalRow,
} from "@/lib/commercial-api";
import {
  commercialStatusLabel,
  formatDate,
  formatUsd,
} from "@/lib/commercial-format";
import styles from "../../page.module.css";

const WINDOWS = [
  { days: 30, label: "30 days" },
  { days: 60, label: "60 days" },
  { days: 90, label: "90 days" },
] as const;

export default function BusinessRenewalsPage() {
  const { hasPermission } = useAuth();
  const canView =
    hasPermission("platform.subscription.view") ||
    hasPermission("platform.billing.view") ||
    hasPermission("platform.revenue.view") ||
    hasPermission("platform.entitlement.manage");

  const [windowDays, setWindowDays] = useState<30 | 60 | 90>(30);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<CommercialRenewalRow[]>([]);

  const load = useCallback(async () => {
    if (!canView) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setUnavailable(false);
    const result = await commercialGet<
      CommercialRenewalRow[] | { items: CommercialRenewalRow[] }
    >(COMMERCIAL_PATHS.renewals, {
      query: { withinDays: String(windowDays) },
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
  }, [canView, windowDays]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <CreatorPage
      title="Renewals"
      subtitle={
        <>
          <Link href="/business">Business</Link>
          {" · Upcoming commercial renewals"}
        </>
      }
      width="wide"
    >
      {!canView ? (
        <p className={styles.error}>Missing permission: platform.subscription.view</p>
      ) : null}

      <ForgeToolbar
        actions={
          <button type="button" className="forge-btn forge-btn--secondary" onClick={() => void load()}>
            Refresh
          </button>
        }
      >
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {WINDOWS.map((w) => (
            <button
              key={w.days}
              type="button"
              className={
                windowDays === w.days
                  ? "forge-btn forge-btn--primary"
                  : "forge-btn forge-btn--outline"
              }
              onClick={() => setWindowDays(w.days)}
            >
              {w.label}
            </button>
          ))}
        </div>
      </ForgeToolbar>

      {loading ? (
        <ForgePageSection title={`Renewals (${windowDays} days)`}>
          <ForgeSkeleton height="6rem" />
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
        <ForgePageSection title={`Renewals (${windowDays} days)`}>
          {items.length === 0 ? (
            <EmptyState
              title="No renewals in this window"
              description="Subscriptions with renewal dates in the selected range will appear here."
            />
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Subscription</th>
                  <th>Plan</th>
                  <th>Status</th>
                  <th>Renewal</th>
                  <th>Price</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id}>
                    <td>{row.tenantDisplayName ?? "—"}</td>
                    <td>
                      <Link href={subscriptionDetailHref(row.id, row.tenantId)}>
                        {row.subscriptionNumber ?? row.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td>{row.planCode ?? "—"}</td>
                    <td>
                      {row.commercialStatus ? (
                        <ForgeStatusBadge
                          status={row.commercialStatus}
                          label={commercialStatusLabel(row.commercialStatus)}
                        />
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>{formatDate(row.renewalDate)}</td>
                    <td>{formatUsd(row.effectivePriceCents)}</td>
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
