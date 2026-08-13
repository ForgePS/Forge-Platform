"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  CreatorPage,
  EmptyState,
  ErrorState,
  ForgePageSection,
  ForgeSkeleton,
} from "@/components/creator-page";
import { useAuth } from "@/hooks/use-auth";
import {
  COMMERCIAL_BACKEND_CONDITION,
  COMMERCIAL_PATHS,
  commercialGet,
  type CommercialAnalyticsSummary,
} from "@/lib/commercial-api";
import { formatUsd } from "@/lib/commercial-format";
import styles from "../../page.module.css";

function metric(cents: number | null | undefined): string {
  return formatUsd(cents);
}

export default function BusinessRevenuePage() {
  const { hasPermission } = useAuth();
  const canView =
    hasPermission("platform.revenue.view") ||
    hasPermission("platform.billing.view") ||
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
    } else {
      setSummary(result.data);
    }
    setLoading(false);
  }, [canView]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <CreatorPage
      title="Revenue"
      subtitle={
        <>
          <Link href="/business">Business</Link>
          {" · ARR / MRR from commercial analytics only"}
        </>
      }
    >
      {!canView ? (
        <p className={styles.error}>Missing permission: platform.revenue.view</p>
      ) : null}

      {loading ? (
        <ForgePageSection title="Revenue metrics">
          <ForgeSkeleton height="5rem" />
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

      {!loading && !unavailable && !error && summary ? (
        <ForgePageSection title="Revenue metrics">
          <div
            style={{
              display: "grid",
              gap: "0.75rem",
              gridTemplateColumns: "repeat(auto-fill, minmax(12rem, 1fr))",
            }}
          >
            <div className={styles.panel} style={{ margin: 0 }}>
              <div className={styles.muted}>ARR</div>
              <div style={{ fontSize: "1.35rem", fontWeight: 600 }}>
                {metric(summary.arrCents)}
              </div>
            </div>
            <div className={styles.panel} style={{ margin: 0 }}>
              <div className={styles.muted}>MRR</div>
              <div style={{ fontSize: "1.35rem", fontWeight: 600 }}>
                {metric(summary.mrrCents)}
              </div>
            </div>
            <div className={styles.panel} style={{ margin: 0 }}>
              <div className={styles.muted}>Active subscriptions</div>
              <div style={{ fontSize: "1.35rem", fontWeight: 600 }}>
                {summary.activeSubscriptionCount == null
                  ? "Not available"
                  : summary.activeSubscriptionCount}
              </div>
            </div>
            <div className={styles.panel} style={{ margin: 0 }}>
              <div className={styles.muted}>Outstanding balance</div>
              <div style={{ fontSize: "1.35rem", fontWeight: 600 }}>
                {metric(summary.outstandingBalanceCents)}
              </div>
            </div>
          </div>
          <p className={styles.muted} style={{ marginTop: "1rem" }}>
            Figures come only from GET /api/v1/platform/commercial/analytics/summary. Missing fields
            show as Not available — nothing is estimated or fabricated.
          </p>
        </ForgePageSection>
      ) : null}

      {!loading && !unavailable && !error && !summary && canView ? (
        <EmptyState
          title="No revenue data"
          description="The analytics summary endpoint returned no revenue fields."
        />
      ) : null}
    </CreatorPage>
  );
}
