"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import {
  ActivityTimeline,
  EmptyState,
  ErrorState,
  ForgeMetricCard,
  ForgeMetricGrid,
  ForgePageActions,
  ForgePageHeader,
  ForgeSkeleton,
  ForgeStatusCard,
  StatusBadge,
} from "@forge/ui";
import { PlatformPageGate } from "@/components/platform-page-gate";
import { useAuth } from "@/hooks/use-auth";
import { tenantDetailHref } from "@/hooks/use-tenant-id";
import {
  apiGet,
  fetchHealth,
  fetchReady,
  listInvitations,
  type HealthPayload,
  type ReadyPayload,
} from "@/lib/api";
import { getMigrationStatusService } from "@/lib/migrations/mock-migration.service";
import type { MigrationSummary } from "@/lib/migrations/migration.types";
import styles from "./page.module.css";

type AnalyticsOverview = {
  generatedAt: string;
  tenants: {
    total: number;
    active: number;
    trial: number;
    suspended: number;
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
  onboarding: {
    inProgress: number;
    completed: number;
    failed: number;
  };
  recentActivity: Array<{
    occurredAt: string;
    action: string;
    resourceType: string;
    result: string;
    tenantKey: string | null;
  }>;
};

type TenantRow = {
  id: string;
  displayName: string;
  status: string;
  tenantKey: string;
};

type JobRow = { id: string; status?: string };

function metricOrUnavailable(value: number | null | undefined, loading: boolean) {
  if (loading) return undefined;
  return value ?? null;
}

function DashboardInner() {
  const { me, loading: authLoading, error: authError, hasPermission } = useAuth();
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [overviewUnavailable, setOverviewUnavailable] = useState(false);
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [ready, setReady] = useState<ReadyPayload | null>(null);
  const [tenants, setTenants] = useState<TenantRow[] | null>(null);
  const [pendingInvites, setPendingInvites] = useState<number | null>(null);
  const [importJobs, setImportJobs] = useState<number | null>(null);
  const [migrations, setMigrations] = useState<MigrationSummary[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canAnalytics = hasPermission("platform.analytics.read") || Boolean(me?.isPlatformAdmin);
  const canTenants = hasPermission("platform.tenant.read") || Boolean(me?.isPlatformAdmin);
  const canInvites = hasPermission("platform.invitation.read") || Boolean(me?.isPlatformAdmin);
  const canJobs = hasPermission("platform.jobs.read") || hasPermission("import.view") || Boolean(me?.isPlatformAdmin);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [healthResult, readyResult] = await Promise.allSettled([fetchHealth(), fetchReady()]);
      setHealth(healthResult.status === "fulfilled" ? healthResult.value : null);
      setReady(readyResult.status === "fulfilled" ? readyResult.value : null);

      if (canAnalytics) {
        try {
          setOverview(await apiGet<AnalyticsOverview>("/api/v1/platform/analytics/overview"));
          setOverviewUnavailable(false);
        } catch {
          setOverview(null);
          setOverviewUnavailable(true);
        }
      } else {
        setOverview(null);
        setOverviewUnavailable(false);
      }

      if (canTenants) {
        try {
          setTenants(await apiGet<TenantRow[]>("/api/v1/platform/tenants"));
        } catch {
          setTenants(null);
        }
      } else {
        setTenants(null);
      }

      if (canInvites && me?.tenantId) {
        try {
          const invites = await listInvitations({ tenantId: me.tenantId, status: "PENDING" });
          setPendingInvites(invites.length);
        } catch {
          setPendingInvites(null);
        }
      } else {
        setPendingInvites(null);
      }

      if (canJobs) {
        try {
          const jobs = await apiGet<JobRow[]>("/api/v1/platform/jobs");
          setImportJobs(jobs.length);
        } catch {
          try {
            const jobs = await apiGet<JobRow[]>("/api/v1/imports/jobs");
            setImportJobs(jobs.length);
          } catch {
            setImportJobs(null);
          }
        }
      } else {
        setImportJobs(null);
      }

      try {
        setMigrations(await getMigrationStatusService().listMigrations());
      } catch {
        setMigrations(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, [canAnalytics, canInvites, canJobs, canTenants, me?.tenantId]);

  useEffect(() => {
    if (!authLoading) void load();
  }, [authLoading, load]);

  const customerCount = tenants?.length ?? overview?.tenants.total ?? null;
  const recentCustomers = (tenants ?? []).slice(0, 5);
  const recentMigrations = (migrations ?? []).slice(0, 5);
  const activityItems =
    overview?.recentActivity.slice(0, 8).map((event, index) => ({
      id: `${event.occurredAt}-${index}`,
      title: event.action,
      detail: `${event.resourceType} · ${event.result}${event.tenantKey ? ` · ${event.tenantKey}` : ""}`,
      at: new Date(event.occurredAt).toLocaleString(),
      tone: event.result.toLowerCase().includes("fail") ? ("danger" as const) : ("neutral" as const),
    })) ?? [];

  return (
    <section className={styles.page}>
      <ForgePageHeader
        title="Overview"
        subtitle="Platform home — live metrics only. Missing data shows Not available."
        actions={
          <ForgePageActions>
            <Link className="forge-btn" href="/customers/new/">
              Add customer
            </Link>
            <Link className="forge-btn forge-btn--outline" href="/invitations/">
              Invitations
            </Link>
            <Link className="forge-btn forge-btn--secondary" href="/migrations/">
              Migration Center
            </Link>
          </ForgePageActions>
        }
      />

      {authError ? <p className={styles.error}>{authError}</p> : null}
      {error ? <ErrorState title="Dashboard error" description={error} /> : null}
      {loading || authLoading ? (
        <ForgeMetricGrid>
          <ForgeSkeleton height="5rem" />
          <ForgeSkeleton height="5rem" />
          <ForgeSkeleton height="5rem" />
          <ForgeSkeleton height="5rem" />
        </ForgeMetricGrid>
      ) : null}

      <ForgeMetricGrid>
        <ForgeMetricCard
          label="Customers"
          value={metricOrUnavailable(customerCount, loading)}
          {...(overview ? { hint: `Active ${overview.tenants.active}` } : {})}
        />
        <ForgeMetricCard
          label="Pending invitations"
          value={metricOrUnavailable(pendingInvites, loading)}
          {...(!canInvites ? { hint: "Requires invitation read permission" } : {})}
        />
        <ForgeMetricCard
          label="Import / jobs"
          value={metricOrUnavailable(importJobs, loading)}
          {...(!canJobs ? { hint: "Requires jobs or import permission" } : {})}
        />
        <ForgeMetricCard
          label="Onboarding in progress"
          value={metricOrUnavailable(overview?.onboarding.inProgress, loading || overviewUnavailable)}
        />
      </ForgeMetricGrid>

      <div className={styles.panel}>
        <h2>Platform health</h2>
        <ForgeMetricGrid>
          <ForgeStatusCard
            title="API"
            status={health?.status ?? "Not available"}
            {...(health?.version ? { detail: `Version ${health.version}` } : {})}
          />
          <ForgeStatusCard
            title="Database"
            status={
              ready?.checks.database === true
                ? "ready"
                : ready?.checks.database === false
                  ? "not ready"
                  : "Not available"
            }
          />
          <ForgeStatusCard title="Workers" status="Not available" detail="No workers endpoint in API" />
          <ForgeStatusCard title="CloudFront" status="Not available" detail="No CloudFront metric endpoint" />
          <ForgeStatusCard title="Cognito" status="Not available" detail="No Cognito health endpoint" />
        </ForgeMetricGrid>
        <p className={styles.linkRow}>
          <Link href="/operations/health/">Operations health</Link>
          <Link href="/health/">System health detail</Link>
        </p>
      </div>

      <div className={styles.panel}>
        <h2>Recent customers</h2>
        {tenants === null && !loading ? (
          <p className={styles.muted}>Not available</p>
        ) : recentCustomers.length === 0 ? (
          <EmptyState title="No customers yet" description="Create a customer to get started." action={<Link className="forge-btn" href="/customers/new/">Add customer</Link>} />
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Status</th>
                <th>Key</th>
              </tr>
            </thead>
            <tbody>
              {recentCustomers.map((row) => (
                <tr key={row.id}>
                  <td>
                    <Link href={tenantDetailHref(row.id)}>{row.displayName}</Link>
                  </td>
                  <td>
                    <StatusBadge tone={row.status === "ACTIVE" ? "success" : "neutral"}>{row.status}</StatusBadge>
                  </td>
                  <td className={styles.mono}>{row.tenantKey}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className={styles.linkRow}>
          <Link href="/customers/">All customers</Link>
        </p>
      </div>

      <div className={styles.panel}>
        <h2>Recent migrations</h2>
        {migrations === null ? (
          <p className={styles.muted}>Not available</p>
        ) : recentMigrations.length === 0 ? (
          <EmptyState title="No migrations" description="Migration jobs appear when an adapter is connected." />
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Status</th>
                <th>Data</th>
              </tr>
            </thead>
            <tbody>
              {recentMigrations.map((row) => (
                <tr key={row.id}>
                  <td>
                    <Link href={`/migrations/detail/?id=${encodeURIComponent(row.id)}`}>{row.tenantDisplayName}</Link>
                  </td>
                  <td>
                    <StatusBadge tone={row.status === "FAILED" ? "danger" : row.status === "COMPLETE" ? "success" : "info"}>
                      {row.status}
                    </StatusBadge>
                  </td>
                  <td>{row.dataSource}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className={styles.panel}>
        <h2>Admin activity</h2>
        {overviewUnavailable || !overview ? (
          <p className={styles.muted}>
            {canAnalytics ? "Not available" : "Requires platform.analytics.read"}
          </p>
        ) : (
          <ActivityTimeline items={activityItems} emptyLabel="No recent audit events." />
        )}
        <p className={styles.linkRow}>
          <Link href="/audit/">Audit log</Link>
        </p>
      </div>
    </section>
  );
}

export default function HomePage() {
  return (
    <PlatformPageGate title="Overview" anyOf={["platform.tenant.read", "platform.analytics.read"]}>
      <Suspense fallback={<p className={styles.muted}>Loading…</p>}>
        <DashboardInner />
      </Suspense>
    </PlatformPageGate>
  );
}
