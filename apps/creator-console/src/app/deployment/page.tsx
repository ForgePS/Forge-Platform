"use client";

import {
  CreatorPage,
  ErrorState,
  ForgePageSection,
  } from "@/components/creator-page";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { fetchHealth, fetchReady, type HealthPayload, type ReadyPayload } from "@/lib/api";
import styles from "../page.module.css";

export default function DeploymentPage() {
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [ready, setReady] = useState<ReadyPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const appEnv = process.env.NEXT_PUBLIC_APP_ENV ?? process.env.APP_ENV ?? "local";
  const appVersion = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0";
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [healthResult, readyResult] = await Promise.allSettled([fetchHealth(), fetchReady()]);
      if (healthResult.status === "fulfilled") setHealth(healthResult.value);
      if (readyResult.status === "fulfilled") setReady(readyResult.value);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't load this information.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const deployment = {
    console: {
      environment: appEnv,
      version: appVersion,
      apiUrl,
      buildTimestamp: health?.timestamp ?? ready?.timestamp ?? null,
    },
    platformApi: health
      ? {
          environment: health.environment,
          version: health.version,
          lastHealthCheck: health.timestamp,
        }
      : null,
    readiness: ready,
  };

  return (
    <CreatorPage
      title="Deployment information"
      subtitle="Release, environment, and last-known deployment timestamps from live API probes."
    >
      {error ? (
        <ErrorState title="We couldn't load this information." description={error} />
      ) : null}
      {loading ? <p className={styles.muted}>Loading…</p> : null}

      <ForgePageSection title="Environment">
        <dl className={styles.dl}>
          <dt>Console environment</dt>
          <dd>{appEnv}</dd>
          <dt>Console version</dt>
          <dd>{appVersion}</dd>
          <dt>API environment</dt>
          <dd>{health?.environment ?? "—"}</dd>
          <dt>API version</dt>
          <dd>{health?.version ?? "—"}</dd>
          <dt>Last health check</dt>
          <dd className={styles.mono}>{health?.timestamp ?? "—"}</dd>
          <dt>Last readiness check</dt>
          <dd className={styles.mono}>{ready?.timestamp ?? "—"}</dd>
        </dl>
      </ForgePageSection>

      <details className="forge-advanced-details">
        <summary>Advanced Details</summary>
        <dl className={styles.dl}>
          <dt>API URL</dt>
          <dd className={styles.mono}>{apiUrl}</dd>
        </dl>
        <pre className={styles.pre}>{JSON.stringify(deployment, null, 2)}</pre>
      </details>

      <p className={styles.linkRow}>
        <Link href="/health">Platform health</Link>
        <Link href="/">Dashboard</Link>
      </p>
    </CreatorPage>
  );
}
