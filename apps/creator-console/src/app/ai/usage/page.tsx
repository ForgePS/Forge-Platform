"use client";

import {
  CreatorLoading,
  CreatorPage,
  ForgePageSection,
  } from "@/components/creator-page";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { TenantRequired } from "@/components/tenant-required";
import { useAuth } from "@/hooks/use-auth";
import { tenantQuery, useTenantId } from "@/hooks/use-tenant-id";
import { apiGet } from "@/lib/api";
import styles from "../../page.module.css";

type UsageRow = {
  id: string;
  product: string;
  outcome: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: string | null;
  latencyMs: number | null;
  occurredAt: string;
};

function Inner() {
  const tenantId = useTenantId();
  const { hasPermission } = useAuth();
  const canRead =
    hasPermission("ai.narrative.view_usage") || hasPermission("platform.ai.usage.view");
  const [items, setItems] = useState<UsageRow[]>([]);
  const [summary, setSummary] = useState<{
    monthRequestCount: number;
    monthInputTokens: number;
    monthOutputTokens: number;
  } | null>(null);
  const [loading, setLoading] = useState(Boolean(tenantId));
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tenantId || !canRead) return;
    setLoading(true);
    setError(null);
    try {
      const result = await apiGet<{
        items: UsageRow[];
        summary: {
          monthRequestCount: number;
          monthInputTokens: number;
          monthOutputTokens: number;
        };
      }>("/api/v1/ai/usage", { query: { tenantId, limit: "100" } });
      setItems(result.items);
      setSummary(result.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't load this information.");
    } finally {
      setLoading(false);
    }
  }, [tenantId, canRead]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!tenantId) {
    return (
      <CreatorPage title="AI Usage">
        <TenantRequired />
      </CreatorPage>
    );
  }

  return (
    <CreatorPage
      title="AI Usage"
      subtitle={<>Tenant-isolated usage for <span className={styles.mono}>{tenantId}</span> ·{" "}
        <Link href={`/ai${tenantQuery(tenantId)}`}>Overview</Link></>}
      >
      {!canRead ? <p className={styles.error}>Missing usage view permission</p> : null}
      {error ? <p className={styles.error}>{error}</p> : null}
      {loading ? <p className={styles.muted}>Loading…</p> : null}
      {summary ? (
        <ForgePageSection title="This month">
          <dl className={styles.dl}>
            <dt>Requests</dt>
            <dd>{summary.monthRequestCount}</dd>
            <dt>Input tokens</dt>
            <dd>{summary.monthInputTokens}</dd>
            <dt>Output tokens</dt>
            <dd>{summary.monthOutputTokens}</dd>
          </dl>
        </ForgePageSection>
      ) : null}
      <ForgePageSection title="Recent events">
        {items.length === 0 && !loading ? (
          <p className={styles.muted}>No usage recorded.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>When</th>
                <th>Product</th>
                <th>Outcome</th>
                <th>Tokens</th>
                <th>Latency</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id}>
                  <td>{new Date(row.occurredAt).toLocaleString()}</td>
                  <td>{row.product}</td>
                  <td>{row.outcome}</td>
                  <td>
                    {row.inputTokens}/{row.outputTokens}
                  </td>
                  <td>{row.latencyMs ?? "—"} ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </ForgePageSection>
    </CreatorPage>
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={<CreatorLoading />}
    >
      <Inner />
    </Suspense>
  );
}
