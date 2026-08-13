"use client";

import {
  CreatorLoading,
  CreatorPage,
  } from "@/components/creator-page";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { TenantRequired } from "@/components/tenant-required";
import { useAuth } from "@/hooks/use-auth";
import { tenantQuery, useTenantId } from "@/hooks/use-tenant-id";
import { apiGet } from "@/lib/api";
import styles from "../../page.module.css";

type AuditRow = {
  id: string;
  action: string;
  product: string;
  recordType: string | null;
  recordId: string | null;
  requestId: string | null;
  correlationId: string;
  occurredAt: string;
};

function Inner() {
  const tenantId = useTenantId();
  const { hasPermission } = useAuth();
  const canRead =
    hasPermission("ai.narrative.view_audit") ||
    hasPermission("platform.ai.narrative.manage") ||
    hasPermission("platform.ai.usage.view");
  const [items, setItems] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(Boolean(tenantId));
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tenantId || !canRead) return;
    setLoading(true);
    setError(null);
    try {
      const result = await apiGet<{ items: AuditRow[] }>("/api/v1/ai/audit", {
        query: { tenantId, limit: "100" },
      });
      setItems(result.items);
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
      <CreatorPage title="AI Audit">
        <TenantRequired />
      </CreatorPage>
    );
  }

  return (
    <CreatorPage
      title="AI Audit"
      subtitle={<>AI narrative audit events for <span className={styles.mono}>{tenantId}</span> ·{" "}
        <Link href={`/ai${tenantQuery(tenantId)}`}>Overview</Link></>}
      >
      <p className={styles.muted}>
        Restricted source payloads are excluded from default audit metadata.
      </p>
      {!canRead ? <p className={styles.error}>Missing audit permission</p> : null}
      {error ? <p className={styles.error}>{error}</p> : null}
      {loading ? <p className={styles.muted}>Loading…</p> : null}
      <div className={styles.panel}>
        {items.length === 0 && !loading ? (
          <p className={styles.muted}>No AI audit events.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>When</th>
                <th>Action</th>
                <th>Product</th>
                <th>Record</th>
                <th>Request</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id}>
                  <td>{new Date(row.occurredAt).toLocaleString()}</td>
                  <td>{row.action}</td>
                  <td>{row.product}</td>
                  <td className={styles.mono}>
                    {row.recordType ? `${row.recordType}:${row.recordId ?? ""}` : "—"}
                  </td>
                  <td className={styles.mono}>{row.requestId ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
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
