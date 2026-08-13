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
} from "@/components/creator-page";
import { useAuth } from "@/hooks/use-auth";
import {
  COMMERCIAL_BACKEND_CONDITION,
  COMMERCIAL_PATHS,
  commercialGet,
  subscriptionDetailHref,
  type CommercialAnalyticsSummary,
  type CommercialAttentionRow,
  type CommercialChangeRow,
  type CommercialRenewalRow,
} from "@/lib/commercial-api";
import {
  commercialStatusLabel,
  formatDate,
  formatUsd,
} from "@/lib/commercial-format";
import styles from "../page.module.css";

function metricValue(cents: number | null | undefined): string {
  return formatUsd(cents);
}

function metricCount(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "Not available";
  return String(value);
}

function BackendUnavailable() {
  return (
    <EmptyState
      title="Commercial API not available"
      description={COMMERCIAL_BACKEND_CONDITION}
    />
  );
}

export default function BusinessOverviewPage() {
  const { hasPermission } = useAuth();
  const canView =
    hasPermission("platform.revenue.view") ||
    hasPermission("platform.billing.view") ||
    hasPermission("platform.subscription.view") ||
    hasPermission("platform.entitlement.manage");

  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<CommercialAnalyticsSummary | null>(null);

  const load = useCallback(async () => {
    if (!canView) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setUnavailable(false);
    const result = await commercialGet<CommercialAnalyticsSummary>(
      COMMERCIAL_PATHS.analyticsSummary,
    );
    if (result.status === "unavailable") {
      setUnavailable(true);
      setSummary(null);
    } else if (result.status === "error") {
      setError(result.message);
      setSummary(null);
    } else if (result.status === "ok") {
      setSummary(result.data);
    }
    setLoading(false);
  }, [canView]);

  useEffect(() => {
    void load();
  }, [load]);

  const renewals30d: CommercialRenewalRow[] = summary?.renewals30d ?? [];
  const pastDue: CommercialAttentionRow[] = summary?.pastDue ?? [];
  const recentChanges: CommercialChangeRow[] = summary?.recentChanges ?? [];
  const needsAttention: CommercialAttentionRow[] = summary?.needsAttention ?? [];

  return (
    <CreatorPage
      title="Business"
      subtitle="Subscription commercial overview — live metrics only."
      actions={
        <Link className="forge-btn forge-btn--outline" href="/business/subscriptions">
          Subscriptions
        </Link>
      }
      width="wide"
    >
      <div className={styles.panel} role="status" style={{ marginBottom: "1rem" }}>
        <strong>Payment Processing:</strong> Manual
        <p className={styles.muted} style={{ margin: "0.35rem 0 0" }}>
          Card charging and auto-pay are not enabled. Record payments manually after funds are
          received.
        </p>
      </div>

      {!canView ? (
        <p className={styles.error}>
          Missing permission: platform.billing.view or platform.subscription.view
        </p>
      ) : null}

      {loading ? (
        <ForgePageSection title="Metrics">
          <ForgeSkeleton height="5rem" />
        </ForgePageSection>
      ) : null}

      {!loading && unavailable ? <BackendUnavailable /> : null}

      {!loading && error && !unavailable ? (
        <ErrorState title="We couldn't load this information." description={error} />
      ) : null}

      {!loading && !unavailable && !error && summary ? (
        <>
          <ForgePageSection title="Metrics">
            <div
              style={{
                display: "grid",
                gap: "0.75rem",
                gridTemplateColumns: "repeat(auto-fill, minmax(10rem, 1fr))",
              }}
            >
              <div className={styles.panel} style={{ margin: 0 }}>
                <div className={styles.muted}>ARR</div>
                <div style={{ fontSize: "1.25rem", fontWeight: 600 }}>
                  {metricValue(summary.arrCents)}
                </div>
              </div>
              <div className={styles.panel} style={{ margin: 0 }}>
                <div className={styles.muted}>MRR</div>
                <div style={{ fontSize: "1.25rem", fontWeight: 600 }}>
                  {metricValue(summary.mrrCents)}
                </div>
              </div>
              <div className={styles.panel} style={{ margin: 0 }}>
                <div className={styles.muted}>Active subscriptions</div>
                <div style={{ fontSize: "1.25rem", fontWeight: 600 }}>
                  {metricCount(summary.activeSubscriptionCount)}
                </div>
              </div>
              <div className={styles.panel} style={{ margin: 0 }}>
                <div className={styles.muted}>Upcoming renewals</div>
                <div style={{ fontSize: "1.25rem", fontWeight: 600 }}>
                  {metricCount(summary.upcomingRenewalsCount)}
                </div>
              </div>
              <div className={styles.panel} style={{ margin: 0 }}>
                <div className={styles.muted}>Outstanding balance</div>
                <div style={{ fontSize: "1.25rem", fontWeight: 600 }}>
                  {metricValue(summary.outstandingBalanceCents)}
                </div>
              </div>
              <div className={styles.panel} style={{ margin: 0 }}>
                <div className={styles.muted}>Past due</div>
                <div style={{ fontSize: "1.25rem", fontWeight: 600 }}>
                  {metricCount(summary.pastDueCount)}
                </div>
              </div>
            </div>
          </ForgePageSection>

          <ForgePageSection title="Renewals (30 days)">
            {renewals30d.length === 0 ? (
              <EmptyState
                title="No renewals in the next 30 days"
                description="Upcoming renewals from the commercial analytics API will appear here."
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
                  {renewals30d.map((row) => (
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

          <ForgePageSection title="Past due">
            {pastDue.length === 0 ? (
              <EmptyState
                title="No past-due accounts"
                description="Subscriptions or invoices marked past due will appear here."
              />
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Subscription</th>
                    <th>Status</th>
                    <th>Balance</th>
                    <th>Due</th>
                  </tr>
                </thead>
                <tbody>
                  {pastDue.map((row) => (
                    <tr key={row.id}>
                      <td>{row.tenantDisplayName ?? "—"}</td>
                      <td>
                        <Link href={subscriptionDetailHref(row.id, row.tenantId)}>
                          {row.subscriptionNumber ?? row.id.slice(0, 8)}
                        </Link>
                      </td>
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
                      <td>{formatUsd(row.balanceCents)}</td>
                      <td>{formatDate(row.dueDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </ForgePageSection>

          <ForgePageSection title="Recent changes">
            {recentChanges.length === 0 ? (
              <EmptyState
                title="No recent changes"
                description="Subscription change activity from the analytics API will appear here."
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
                  {recentChanges.map((row) => (
                    <tr key={row.id}>
                      <td>{formatDate(row.effectiveAt ?? row.createdAt)}</td>
                      <td>{row.changeType ?? "—"}</td>
                      <td>{row.summary ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </ForgePageSection>

          <ForgePageSection title="Needs attention">
            {needsAttention.length === 0 ? (
              <EmptyState
                title="Nothing needs attention"
                description="Items flagged by commercial analytics will appear here."
              />
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Subscription</th>
                    <th>Status</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {needsAttention.map((row) => (
                    <tr key={row.id}>
                      <td>{row.tenantDisplayName ?? "—"}</td>
                      <td>
                        <Link href={subscriptionDetailHref(row.id, row.tenantId)}>
                          {row.subscriptionNumber ?? row.id.slice(0, 8)}
                        </Link>
                      </td>
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
                      <td>{row.reason ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </ForgePageSection>
        </>
      ) : null}

      {!loading && !unavailable && !error && !summary && canView ? (
        <EmptyState
          title="No analytics summary"
          description="The commercial analytics endpoint returned no data."
        />
      ) : null}
    </CreatorPage>
  );
}
