"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { TenantPageGate } from "@/components/tenant-page-gate";
import { TenantRequired } from "@/components/tenant-required";
import { useTenantId } from "@/hooks/use-tenant-id";
import { apiGet } from "@/lib/api";
import styles from "../page.module.css";

type AuditEvent = {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  result: string;
  riskLevel: string;
  actorUserId: string | null;
  occurredAt: string;
};

function AuditInner() {
  const tenantId = useTenantId();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(Boolean(tenantId));
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      setEvents(
        await apiGet<AuditEvent[]>(`/api/v1/tenants/${tenantId}/audit-events?page=1&pageSize=50`),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load audit events");
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!tenantId) {
    return (
      <section className={styles.page}>
        <h1>Audit</h1>
        <TenantRequired />
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <h1>Audit</h1>
      <p className={styles.lead}>
        Recent audited actions · <span className={styles.mono}>{tenantId}</span>
      </p>
      {error ? <p className={styles.error}>{error}</p> : null}
      {loading ? <p className={styles.muted}>Loading…</p> : null}

      <div className={styles.panel}>
        {events.length === 0 ? (
          <p className={styles.muted}>No audit events.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Occurred</th>
                <th>Action</th>
                <th>Resource</th>
                <th>Result</th>
                <th>Risk</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id}>
                  <td className={styles.mono}>{event.occurredAt}</td>
                  <td>{event.action}</td>
                  <td>
                    {event.resourceType}
                    {event.resourceId ? (
                      <>
                        <br />
                        <span className={styles.mono}>{event.resourceId}</span>
                      </>
                    ) : null}
                  </td>
                  <td>{event.result}</td>
                  <td>{event.riskLevel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

export default function AuditPage() {
  return (
    <TenantPageGate title="Audit" permission="platform.audit.read">
      <Suspense fallback={<p className={styles.muted}>Loading…</p>}>
        <AuditInner />
      </Suspense>
    </TenantPageGate>
  );
}
