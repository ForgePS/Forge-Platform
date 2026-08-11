"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import {
  apiGet,
  fetchHealth,
  fetchReady,
  type HealthPayload,
  type ReadyPayload,
} from "@/lib/api";
import { PlatformPageGate } from "@/components/platform-page-gate";
import { useAuth } from "@/hooks/use-auth";
import styles from "./page.module.css";

type AnalyticsOverview = {
  generatedAt: string;
  tenants: {
    total: number;
    active: number;
    trial: number;
    suspended: number;
    byStatus: Record<string, number>;
  };
  users: {
    totalMemberships: number;
    activeMemberships: number;
    suspendedMemberships: number;
  };
  products: {
    catalogActive: number;
    tenantAssignmentsActive: number;
  };
  modules: {
    adoption: Array<{ moduleCode: string; moduleName: string; tenantCount: number }>;
  };
  onboarding: {
    inProgress: number;
    completed: number;
    failed: number;
    total: number;
  };
  billing: {
    byStatus: Record<string, number>;
    activeLike: number;
    trial: number;
  };
  recentActivity: Array<{
    occurredAt: string;
    action: string;
    resourceType: string;
    result: string;
    tenantKey: string | null;
  }>;
};

function DashboardInner() {
  const { me, loading: authLoading, error: authError, hasPermission } = useAuth();
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [ready, setReady] = useState<ReadyPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canAnalytics = hasPermission("platform.analytics.read") || Boolean(me?.isPlatformAdmin);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [healthResult, readyResult] = await Promise.allSettled([
        fetchHealth(),
        fetchReady(),
      ]);
      if (healthResult.status === "fulfilled") setHealth(healthResult.value);
      if (readyResult.status === "fulfilled") setReady(readyResult.value);

      if (canAnalytics) {
        const data = await apiGet<AnalyticsOverview>("/api/v1/platform/analytics/overview");
        setOverview(data);
      } else {
        setOverview(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, [canAnalytics]);

  useEffect(() => {
    if (!authLoading) {
      void load();
    }
  }, [authLoading, load]);

  const appVersion = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0";
  const appEnv = process.env.NEXT_PUBLIC_APP_ENV ?? process.env.APP_ENV ?? "local";

  return (
    <section className={styles.page}>
      <div className="forge-page-header">
        <div>
          <h1 className="forge-page-header__title">Creator Console</h1>
          <p className="forge-page-header__subtitle">
            Platform operations, customer management and system administration.
            {!me ? (
              <>
                {" "}
                <Link href="/login">Sign in</Link> to load platform analytics.
              </>
            ) : (
              <>
                {" "}
                Tenant <span className={styles.mono}>{me.tenantId}</span> ·{" "}
                <Link href="/select-tenant">Switch tenant</Link>
              </>
            )}
          </p>
        </div>
        <div className="forge-page-actions">
          <Link className="forge-btn" href="/tenants">
            + New Tenant
          </Link>
          <Link className="forge-btn forge-btn--outline" href="/users">
            + Invite User
          </Link>
          <Link className="forge-btn forge-btn--secondary" href="/entitlements">
            + Assign Product
          </Link>
          <Link className="forge-btn forge-btn--secondary" href="/onboarding">
            + Start Onboarding
          </Link>
        </div>
      </div>

      {authError ? <p className={styles.error}>{authError}</p> : null}
      {error ? <p className={styles.error}>{error}</p> : null}
      {loading || authLoading ? <p className={styles.muted}>Loading dashboard…</p> : null}

      {!loading && me && !canAnalytics ? (
        <p className={styles.muted}>
          Platform analytics requires <code>platform.analytics.read</code>. Overview health
          checks remain available below.
        </p>
      ) : null}

      {overview ? (
        <div className="forge-metric-grid">
          <article className="forge-metric-card">
            <p className="forge-metric-card__label">Tenants (total)</p>
            <p className="forge-metric-card__value">{overview.tenants.total}</p>
            <p className="forge-metric-card__hint">
              Active {overview.tenants.active} · Trial {overview.tenants.trial} · Suspended{" "}
              {overview.tenants.suspended}
            </p>
          </article>
          <article className="forge-metric-card">
            <p className="forge-metric-card__label">Active memberships</p>
            <p className="forge-metric-card__value">{overview.users.activeMemberships}</p>
            <p className="forge-metric-card__hint">
              Total {overview.users.totalMemberships} · Suspended{" "}
              {overview.users.suspendedMemberships}
            </p>
          </article>
          <article className="forge-metric-card">
            <p className="forge-metric-card__label">Products</p>
            <p className="forge-metric-card__value">{overview.products.catalogActive}</p>
            <p className="forge-metric-card__hint">
              Active assignments {overview.products.tenantAssignmentsActive}
            </p>
          </article>
          <article className="forge-metric-card">
            <p className="forge-metric-card__label">Onboarding in progress</p>
            <p className="forge-metric-card__value">{overview.onboarding.inProgress}</p>
            <p className="forge-metric-card__hint">
              Completed {overview.onboarding.completed} · Failed {overview.onboarding.failed}
            </p>
          </article>
          <article className="forge-metric-card">
            <p className="forge-metric-card__label">Subscriptions</p>
            <p className="forge-metric-card__value">{overview.billing.activeLike}</p>
            <p className="forge-metric-card__hint">Trials {overview.billing.trial}</p>
          </article>
          <article className="forge-metric-card">
            <p className="forge-metric-card__label">Generated</p>
            <p className="forge-metric-card__value" style={{ fontSize: "1rem" }}>
              {new Date(overview.generatedAt).toLocaleString()}
            </p>
            <p className="forge-metric-card__hint">Platform-wide aggregates only</p>
          </article>
        </div>
      ) : null}

      <div className={styles.panel}>
        <h2>Platform health</h2>
        <dl className={styles.dl}>
          <dt>API</dt>
          <dd>
            {health ? (
              <span className={styles.badgeOk}>{health.status}</span>
            ) : (
              <span className={styles.badgeBad}>unreachable</span>
            )}
          </dd>
          <dt>Database</dt>
          <dd>
            {ready?.checks.database ? (
              <span className={styles.badgeOk}>ready</span>
            ) : ready ? (
              <span className={styles.badgeBad}>not ready</span>
            ) : (
              <span className={styles.badgeWarn}>unknown</span>
            )}
          </dd>
          <dt>Environment</dt>
          <dd>{health?.environment ?? appEnv}</dd>
          <dt>API version</dt>
          <dd>{health?.version ?? "—"}</dd>
          <dt>Console version</dt>
          <dd>{appVersion}</dd>
        </dl>
        <p className={styles.linkRow}>
          <Link href="/health">Platform health detail</Link>
          <Link href="/deployment">Deployment information</Link>
          <Link href="/migrations">Data migration</Link>
        </p>
      </div>

      {overview ? (
        <>
          <div className={styles.panel}>
            <h2>Module adoption</h2>
            {overview.modules.adoption.length === 0 ? (
              <p className={styles.muted}>No active module entitlements.</p>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Module</th>
                    <th>Code</th>
                    <th>Tenants</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.modules.adoption.map((row) => (
                    <tr key={row.moduleCode}>
                      <td>{row.moduleName}</td>
                      <td className={styles.mono}>{row.moduleCode}</td>
                      <td>{row.tenantCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className={styles.panel}>
            <h2>Recent platform activity</h2>
            {overview.recentActivity.length === 0 ? (
              <p className={styles.muted}>No recent audit events.</p>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Occurred</th>
                    <th>Action</th>
                    <th>Resource</th>
                    <th>Tenant</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.recentActivity.map((event, index) => (
                    <tr key={`${event.occurredAt}-${event.action}-${index}`}>
                      <td className={styles.mono}>{event.occurredAt}</td>
                      <td>{event.action}</td>
                      <td>{event.resourceType}</td>
                      <td className={styles.mono}>{event.tenantKey ?? "—"}</td>
                      <td>{event.result}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className={styles.linkRow}>
              <Link href="/audit">Tenant audit (selected tenant)</Link>
            </p>
          </div>
        </>
      ) : null}
    </section>
  );
}

export default function HomePage() {
  return (
    <PlatformPageGate
      title="Overview"
      anyOf={["platform.tenant.read", "platform.analytics.read"]}
    >
      <Suspense fallback={<p className={styles.muted}>Loading…</p>}>
        <DashboardInner />
      </Suspense>
    </PlatformPageGate>
  );
}
