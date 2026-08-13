"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  EmptyState,
  ErrorState,
  ForgePageHeader,
  LoadingState,
  StatusBadge,
} from "@forge/ui";
import { PlatformPageGate } from "@/components/platform-page-gate";
import { useAuth } from "@/hooks/use-auth";
import { apiGet } from "@/lib/api";
import { unavailableLabel } from "@/lib/presentation";
import styles from "../page.module.css";

type SubscriptionRow = {
  id: string;
  status?: string;
  planName?: string | null;
  currentPeriodEnd?: string | null;
  renewsAt?: string | null;
  tenantDisplayName?: string | null;
  tenantId?: string | null;
};

function RenewalsInner() {
  const { me } = useAuth();
  const [rows, setRows] = useState<SubscriptionRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const tenantId = me?.tenantId;
      if (!tenantId) {
        setRows([]);
        return;
      }
      const list = await apiGet<SubscriptionRow[]>(`/api/v1/tenants/${tenantId}/subscriptions`);
      setRows(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't load renewals.");
      setRows(null);
    } finally {
      setLoading(false);
    }
  }, [me?.tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className={styles.page}>
      <ForgePageHeader
        title="Renewals"
        subtitle="Upcoming subscription renewals for the selected customer context."
      />
      {error ? <ErrorState title="Renewals unavailable" description={error} /> : null}
      {loading ? <LoadingState label="Loading renewals…" /> : null}
      {!loading && rows && rows.length === 0 ? (
        <EmptyState
          title="No renewals to show"
          description="Subscriptions with renewal dates appear here when billing data is available for the selected customer."
          action={
            <Link className="forge-btn" href="/subscriptions/">
              View subscriptions
            </Link>
          }
        />
      ) : null}
      {rows && rows.length > 0 ? (
        <div className={styles.panel} style={{ overflowX: "auto" }}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Plan</th>
                <th>Status</th>
                <th>Renewal date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const renewAt = row.renewsAt ?? row.currentPeriodEnd;
                return (
                  <tr key={row.id}>
                    <td>{row.planName ?? "Subscription"}</td>
                    <td>
                      <StatusBadge>{row.status ?? "Unknown"}</StatusBadge>
                    </td>
                    <td>{renewAt ? new Date(renewAt).toLocaleDateString() : unavailableLabel()}</td>
                    <td>
                      <Link href="/billing/">Review</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

export default function RenewalsPage() {
  return (
    <PlatformPageGate
      title="Renewals"
      anyOf={["platform.entitlement.manage", "tenant.billing.read"]}
    >
      <RenewalsInner />
    </PlatformPageGate>
  );
}
