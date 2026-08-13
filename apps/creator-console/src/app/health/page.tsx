"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  CreatorPage,
  ErrorState,
  ForgePageSection,
  ForgeStatusBadge,
} from "@/components/creator-page";
import { fetchHealth, fetchReady, type HealthPayload, type ReadyPayload } from "@/lib/api";
import styles from "../page.module.css";

type HealthRow = {
  label: string;
  status: string | null;
  detail?: string | undefined;
};

export default function HealthPage() {
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [ready, setReady] = useState<ReadyPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [healthResult, readyResult] = await Promise.allSettled([fetchHealth(), fetchReady()]);
      if (healthResult.status === "fulfilled") {
        setHealth(healthResult.value);
      } else {
        setHealth(null);
        setError(
          healthResult.reason instanceof Error
            ? healthResult.reason.message
            : "We couldn't load this information.",
        );
      }
      if (readyResult.status === "fulfilled") {
        setReady(readyResult.value);
      } else {
        setReady(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const consoleHealth = {
    status: "healthy",
    service: "creator-console",
    environment: process.env.NEXT_PUBLIC_APP_ENV ?? process.env.APP_ENV ?? "local",
    version: process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0",
    timestamp: new Date().toISOString(),
  };

  const rows: HealthRow[] = [
    {
      label: "Application",
      status: health?.status ?? (error ? "unavailable" : null),
      detail: health ? `${health.service} · ${health.environment}` : undefined,
    },
    {
      label: "Authentication",
      status: health ? "ready" : error ? "unavailable" : null,
      detail: "Cognito / session",
    },
    {
      label: "Database",
      status: ready ? (ready.checks.database ? "ready" : "not ready") : null,
    },
    {
      label: "Files",
      status: health ? "ready" : null,
      detail: "Object storage / documents",
    },
    {
      label: "Email",
      status: health ? "ready" : null,
      detail: "Outbound mail",
    },
    {
      label: "Background Processing",
      status:
        ready?.checks.outbox == null
          ? health
            ? "n/a"
            : null
          : ready.checks.outbox
            ? "ready"
            : "not ready",
      detail:
        ready?.checks.outboxPending != null || ready?.checks.outboxFailed != null
          ? `Pending ${ready.checks.outboxPending ?? "—"} · Failed ${ready.checks.outboxFailed ?? "—"}`
          : undefined,
    },
  ];

  return (
    <CreatorPage
      title="Platform health"
      subtitle="Live status for core platform services."
      actions={
        <button type="button" className={styles.buttonSecondary} onClick={() => void load()}>
          Refresh
        </button>
      }
    >
      {error ? (
        <ErrorState title="We couldn't load this information." description={error} />
      ) : null}
      {loading ? <p className={styles.muted}>Loading health…</p> : null}

      <ForgePageSection title="Service status" flush>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Service</th>
              <th>Status</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <td>{row.label}</td>
                <td>
                  {row.status ? <ForgeStatusBadge status={row.status} /> : "—"}
                </td>
                <td className={styles.muted}>{row.detail ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ForgePageSection>

      <ForgePageSection title="Creator console">
        <dl className={styles.dl}>
          <dt>Environment</dt>
          <dd>{consoleHealth.environment}</dd>
          <dt>Version</dt>
          <dd>{consoleHealth.version}</dd>
          <dt>Status</dt>
          <dd>
            <ForgeStatusBadge status={consoleHealth.status} />
          </dd>
        </dl>
      </ForgePageSection>

      <details className="forge-advanced-details">
        <summary>Advanced Details</summary>
        <p className={styles.muted}>
          Probes: <span className={styles.mono}>/health</span> ·{" "}
          <span className={styles.mono}>/ready</span>
        </p>
        {health ? (
          <>
            <h3>Platform API health</h3>
            <pre className={styles.pre}>{JSON.stringify(health, null, 2)}</pre>
          </>
        ) : null}
        {ready ? (
          <>
            <h3>Readiness</h3>
            <pre className={styles.pre}>{JSON.stringify(ready, null, 2)}</pre>
          </>
        ) : (
          <p className={styles.muted}>Readiness probe unavailable or database not ready.</p>
        )}
        <h3>Creator console payload</h3>
        <pre className={styles.pre}>{JSON.stringify(consoleHealth, null, 2)}</pre>
      </details>

      <p className={styles.linkRow}>
        <Link href="/">Back to dashboard</Link>
      </p>
    </CreatorPage>
  );
}
