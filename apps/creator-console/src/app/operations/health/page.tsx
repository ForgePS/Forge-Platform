"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ForgePageHeader,
  ForgeStatusCard,
  LoadingState,
} from "@forge/ui";
import { PlatformPageGate } from "@/components/platform-page-gate";
import { fetchHealth, fetchReady, type HealthPayload, type ReadyPayload } from "@/lib/api";
import styles from "../../page.module.css";

function OperationsHealthInner() {
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
            : "Health check failed",
        );
      }
      setReady(readyResult.status === "fulfilled" ? readyResult.value : null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const apiStatus = health?.status ?? (loading ? "Loading…" : "Not available");
  const dbStatus = ready?.checks.database
    ? "ready"
    : ready
      ? "not ready"
      : loading
        ? "Loading…"
        : "Not available";

  return (
    <section className={styles.page}>
      <ForgePageHeader
        title="Operations health"
        subtitle="Live platform-api /health and /ready probes only. No fabricated cloud metrics."
      />

      {error ? <p className={styles.error}>{error}</p> : null}
      {loading ? <LoadingState label="Loading health…" /> : null}

      <div className={styles.statGrid}>
        <ForgeStatusCard
          title="API status"
          status={apiStatus}
          {...(health?.service ? { detail: health.service } : {})}
        />
        <ForgeStatusCard
          title="Database"
          status={dbStatus}
          {...(ready?.status ? { detail: ready.status } : {})}
        />
        <ForgeStatusCard title="Queue" status="Not available" detail="No queue probe exposed" />
        <ForgeStatusCard title="AWS metrics" status="Not available" detail="No AWS metrics endpoint" />
      </div>

      <div className={styles.panel}>
        <h2>Platform API health</h2>
        {health ? (
          <pre className={styles.pre}>{JSON.stringify(health, null, 2)}</pre>
        ) : (
          <p className={styles.muted}>Platform API health unavailable.</p>
        )}
      </div>

      <div className={styles.panel}>
        <h2>Readiness</h2>
        {ready ? (
          <pre className={styles.pre}>{JSON.stringify(ready, null, 2)}</pre>
        ) : (
          <p className={styles.muted}>Readiness probe unavailable or database not ready.</p>
        )}
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.buttonSecondary} onClick={() => void load()}>
          Refresh
        </button>
        <Link href="/health/">System health detail</Link>
      </div>
    </section>
  );
}

export default function OperationsHealthPage() {
  return (
    <PlatformPageGate title="Operations health" permission="platform.tenant.read">
      <OperationsHealthInner />
    </PlatformPageGate>
  );
}
