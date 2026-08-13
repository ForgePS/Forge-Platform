"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { ForgePageContainer, ForgePageHeader, ForgePageSection, ForgeStatusBadge } from "@forge/ui";
import {
  apiGet,
  fetchHealth,
  fetchReady,
  listInvitations,
  listMemberships,
  type HealthPayload,
  type ReadyPayload,
} from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { tenantQuery } from "@/hooks/use-tenant-id";
import styles from "./page.module.css";

type Tenant = {
  id: string;
  status: string;
  displayName: string;
};

type AuditEvent = {
  id: string;
  action: string;
  resourceType: string;
  occurredAt: string;
  result: string;
};

type Subscription = {
  id: string;
  status: string;
  planCode: string | null;
};

type User = {
  id: string;
  status: string;
};

type DashboardStats = {
  activeTenants: number | null;
  pendingInvitations: number | null;
  activeUsers: number | null;
  suspendedMemberships: number | null;
  activeSubscriptions: number | null;
  recentAudit: AuditEvent[];
  health: HealthPayload | null;
  ready: ReadyPayload | null;
  queueHealth: "ok" | "degraded" | "unavailable" | null;
};

function DashboardInner() {
  const { me, loading: authLoading, error: authError } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const next: DashboardStats = {
      activeTenants: null,
      pendingInvitations: null,
      activeUsers: null,
      suspendedMemberships: null,
      activeSubscriptions: null,
      recentAudit: [],
      health: null,
      ready: null,
      queueHealth: "unavailable",
    };

    try {
      const [healthResult, readyResult] = await Promise.allSettled([fetchHealth(), fetchReady()]);
      if (healthResult.status === "fulfilled") next.health = healthResult.value;
      if (readyResult.status === "fulfilled" && readyResult.value) {
        next.ready = readyResult.value;
        const checks = readyResult.value.checks;
        if (checks.outbox === false) {
          next.queueHealth = "unavailable";
        } else if (
          checks.outbox === true &&
          ((checks.outboxFailed ?? 0) > 0 || (checks.outboxPending ?? 0) > 100)
        ) {
          next.queueHealth = "degraded";
        } else if (checks.outbox === true) {
          next.queueHealth = "ok";
        } else {
          next.queueHealth = "unavailable";
        }
      } else {
        next.queueHealth = "unavailable";
      }

      const tenants = await apiGet<Tenant[]>("/api/v1/platform/tenants");
      next.activeTenants = tenants.filter((tenant) => tenant.status === "ACTIVE").length;

      if (me?.tenantId) {
        const tenantId = me.tenantId;

        const [invitationsResult, membershipsResult, usersResult, auditResult, subsResult] =
          await Promise.allSettled([
            listInvitations({ tenantId }),
            listMemberships(tenantId),
            apiGet<User[]>(`/api/v1/tenants/${tenantId}/users`),
            apiGet<AuditEvent[]>(`/api/v1/tenants/${tenantId}/audit-events?page=1&pageSize=5`),
            apiGet<Subscription[]>(`/api/v1/tenants/${tenantId}/subscriptions`),
          ]);

        if (invitationsResult.status === "fulfilled") {
          next.pendingInvitations = invitationsResult.value.filter((row) =>
            ["DRAFT", "PENDING", "SENT"].includes(row.status),
          ).length;
        }
        if (membershipsResult.status === "fulfilled") {
          next.suspendedMemberships = membershipsResult.value.filter(
            (row) => row.status === "SUSPENDED",
          ).length;
        }
        if (usersResult.status === "fulfilled") {
          next.activeUsers = usersResult.value.filter((row) => row.status === "ACTIVE").length;
        }
        if (auditResult.status === "fulfilled") {
          next.recentAudit = auditResult.value;
        }
        if (subsResult.status === "fulfilled") {
          next.activeSubscriptions = subsResult.value.filter((row) =>
            ["ACTIVE", "TRIAL", "GRACE", "GRACE_PERIOD"].includes(row.status),
          ).length;
        }
      }

      setStats(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, [me?.tenantId]);

  useEffect(() => {
    if (!authLoading) {
      void load();
    }
  }, [authLoading, load]);

  const appVersion = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0";
  const appEnv = process.env.NEXT_PUBLIC_APP_ENV ?? process.env.APP_ENV ?? "local";

  return (
    <ForgePageContainer>
      <ForgePageHeader
        title="Creator Console"
        subtitle={
          !me
            ? "Platform operations, customer management and system administration. Sign in to load tenant-scoped stats."
            : "Platform operations, customer management and system administration."
        }
        actions={
          <>
            <Link className="forge-btn" href="/tenants">
              New Customer
            </Link>
            <Link className="forge-btn forge-btn--outline" href="/users">
              Invite User
            </Link>
            <Link className="forge-btn forge-btn--secondary" href="/entitlements">
              Products & Modules
            </Link>
            <Link className="forge-btn forge-btn--secondary" href="/onboarding">
              Start Onboarding
            </Link>
          </>
        }
      />

      {authError ? <p className={styles.error}>{authError}</p> : null}
      {error ? <p className={styles.error}>{error}</p> : null}
      {loading || authLoading ? <p className={styles.muted}>Loading dashboard…</p> : null}

      {stats ? (
        <>
          <div className="forge-metric-grid">
            <article className="forge-metric-card">
              <p className="forge-metric-card__label">Active tenants</p>
              <p className="forge-metric-card__value">{stats.activeTenants ?? "—"}</p>
            </article>
            <article className="forge-metric-card">
              <p className="forge-metric-card__label">Pending invitations</p>
              <p className="forge-metric-card__value">
                {stats.pendingInvitations ?? (me ? "—" : "N/A")}
              </p>
            </article>
            <article className="forge-metric-card">
              <p className="forge-metric-card__label">Active users</p>
              <p className="forge-metric-card__value">{stats.activeUsers ?? (me ? "—" : "N/A")}</p>
            </article>
            <article className="forge-metric-card">
              <p className="forge-metric-card__label">Suspended memberships</p>
              <p className="forge-metric-card__value">
                {stats.suspendedMemberships ?? (me ? "—" : "N/A")}
              </p>
            </article>
            <article className="forge-metric-card">
              <p className="forge-metric-card__label">Active subscriptions</p>
              <p className="forge-metric-card__value">
                {stats.activeSubscriptions ?? (me ? "—" : "N/A")}
              </p>
            </article>
            <article className="forge-metric-card">
              <p className="forge-metric-card__label">Queue health</p>
              <p className="forge-metric-card__value" style={{ fontSize: "1.1rem" }}>
                {stats.queueHealth === "ok"
                  ? "Healthy"
                  : stats.queueHealth === "degraded"
                    ? "Degraded"
                    : "Unavailable"}
              </p>
              <p className="forge-metric-card__hint">
                {stats.ready?.checks.outbox
                  ? `Outbox pending ${stats.ready.checks.outboxPending ?? 0} · failed ${stats.ready.checks.outboxFailed ?? 0}`
                  : "Outbox probe unavailable"}
              </p>
            </article>
          </div>

          <ForgePageSection title="Platform Status" description="Live health probes for the platform API.">
            <dl className={styles.dl}>
              <dt>API</dt>
              <dd>
                {stats.health ? (
                  <ForgeStatusBadge status="ACTIVE" label={stats.health.status} />
                ) : (
                  <ForgeStatusBadge status="SUSPENDED" label="Unreachable" />
                )}
              </dd>
              <dt>Database</dt>
              <dd>
                {stats.ready?.checks.database ? (
                  <ForgeStatusBadge status="READY" label="Ready" />
                ) : stats.ready ? (
                  <ForgeStatusBadge status="NEEDS_ATTENTION" label="Not ready" />
                ) : (
                  <ForgeStatusBadge status="PENDING" label="Unknown" />
                )}
              </dd>
              <dt>Queue</dt>
              <dd>
                {stats.queueHealth === "ok" ? (
                  <ForgeStatusBadge status="ACTIVE" label="Healthy" />
                ) : stats.queueHealth === "degraded" ? (
                  <ForgeStatusBadge status="NEEDS_ATTENTION" label="Degraded" />
                ) : (
                  <ForgeStatusBadge status="PENDING" label={stats.queueHealth ?? "Unavailable"} />
                )}
              </dd>
              <dt>Environment</dt>
              <dd>{stats.health?.environment ?? appEnv}</dd>
              <dt>API version</dt>
              <dd>{stats.health?.version ?? "—"}</dd>
              <dt>Console version</dt>
              <dd>{appVersion}</dd>
            </dl>
            <p className={styles.linkRow}>
              <Link href="/health">Platform health detail</Link>
              <Link href="/deployment">Deployment information</Link>
              <Link href="/migrations">Data migration</Link>
            </p>
          </ForgePageSection>

          <ForgePageSection title="Recent Activity" description="Latest audit events for the active customer.">
            {!me ? (
              <p className={styles.muted}>Sign in and select a tenant to load audit events.</p>
            ) : stats.recentAudit.length === 0 ? (
              <p className={styles.muted}>No recent audit events.</p>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Occurred</th>
                    <th>Action</th>
                    <th>Resource</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentAudit.map((event) => (
                    <tr key={event.id}>
                      <td className={styles.mono}>{event.occurredAt}</td>
                      <td>{event.action}</td>
                      <td>{event.resourceType}</td>
                      <td>
                        <ForgeStatusBadge status={event.result} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {me ? (
              <p className={styles.linkRow}>
                <Link href={`/audit${tenantQuery(me.tenantId)}`}>View full audit log</Link>
              </p>
            ) : null}
          </ForgePageSection>
        </>
      ) : null}
    </ForgePageContainer>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<p className={styles.muted}>Loading…</p>}>
      <DashboardInner />
    </Suspense>
  );
}
