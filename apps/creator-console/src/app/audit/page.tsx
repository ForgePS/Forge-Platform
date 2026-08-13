"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import {
  CreatorLoading,
  CreatorPage,
  ErrorState,
  ForgePageSection,
  ForgeStatusBadge,
} from "@/components/creator-page";
import { tenantDetailHref, useTenantId } from "@/hooks/use-tenant-id";
import { TenantRequired } from "@/components/tenant-required";
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
  correlationId: string | null;
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
      setError(err instanceof Error ? err.message : "We couldn't load this information.");
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!tenantId) {
    return (
      <CreatorPage title="Audit">
        <TenantRequired />
      </CreatorPage>
    );
  }

  return (
    <CreatorPage
      title="Audit"
      subtitle={
        <>
          <Link href={tenantDetailHref(tenantId)}>Back to Customer</Link>
        </>
      }
    >
      {error ? (
        <ErrorState title="We couldn't load this information." description={error} />
      ) : null}

      <ForgePageSection title="Recent events" flush>
        {loading ? <p className={styles.muted}>Loading…</p> : null}
        {!loading && events.length === 0 ? <p className={styles.muted}>No audit events.</p> : null}
        {events.length > 0 ? (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Occurred</th>
                <th>Action</th>
                <th>Resource</th>
                <th>Result</th>
                <th>Risk</th>
                <th>Actor</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id}>
                  <td className={styles.mono}>
                    {typeof event.occurredAt === "string"
                      ? event.occurredAt
                      : String(event.occurredAt)}
                  </td>
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
                  <td>
                    <ForgeStatusBadge status={event.result} />
                  </td>
                  <td>{event.riskLevel}</td>
                  <td className={styles.mono}>{event.actorUserId ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </ForgePageSection>

      <details className="forge-advanced-details">
        <summary>Advanced Details</summary>
        <p className={styles.muted}>
          Customer ID: <span className={styles.mono}>{tenantId}</span>
        </p>
      </details>
    </CreatorPage>
  );
}

export default function AuditPage() {
  return (
    <Suspense fallback={<CreatorLoading />}>
      <AuditInner />
    </Suspense>
  );
}
