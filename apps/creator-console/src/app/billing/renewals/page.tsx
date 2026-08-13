"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { ForgePageSection, ForgeStatusBadge } from "@forge/ui";
import { CreatorLoading, CreatorPage } from "@/components/creator-page";
import { TenantRequired } from "@/components/tenant-required";
import { useAuth } from "@/hooks/use-auth";
import { tenantQuery, useTenantId, tenantDetailHref } from "@/hooks/use-tenant-id";
import { apiGet } from "@/lib/api";
import styles from "../../page.module.css";

type Subscription = {
  id: string;
  status: string;
  planCode: string | null;
  billingCycle: string | null;
  startedAt: string | null;
  endsAt: string | null;
  endDate?: string | null;
  renewalDate?: string | null;
  renewsAt?: string | null;
  createdAt: string;
};

function renewalDateFor(row: Subscription): string | null {
  return row.renewalDate ?? row.renewsAt ?? row.endsAt ?? row.endDate ?? null;
}

function RenewalsInner() {
  const tenantId = useTenantId();
  const { hasPermission } = useAuth();
  const canRead = hasPermission("platform.entitlement.manage");
  const [items, setItems] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(Boolean(tenantId));
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tenantId || !canRead) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setItems(await apiGet<Subscription[]>(`/api/v1/tenants/${tenantId}/subscriptions`));
    } catch {
      setError("We couldn't load subscriptions right now.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [tenantId, canRead]);

  useEffect(() => {
    void load();
  }, [load]);

  const renewals = useMemo(
    () =>
      items
        .map((row) => ({ row, renewalAt: renewalDateFor(row) }))
        .filter((entry) => Boolean(entry.renewalAt))
        .sort((a, b) => Date.parse(a.renewalAt!) - Date.parse(b.renewalAt!)),
    [items],
  );

  if (!tenantId) {
    return (
      <CreatorPage title="Renewals">
        <TenantRequired />
        <Link className="forge-btn forge-btn--secondary" href="/billing" style={{ marginTop: "1rem" }}>
          Back to Billing
        </Link>
      </CreatorPage>
    );
  }

  return (
    <CreatorPage
      title="Renewals"
      subtitle={
        <>
          <Link href="/billing">Billing</Link>
          {" · "}
          <Link href={tenantDetailHref(tenantId)}>Customer</Link>
          {" · "}
          <Link href={`/subscriptions${tenantQuery(tenantId)}`}>Subscriptions</Link>
        </>
      }
    >
      {!canRead ? (
        <p className={styles.error}>Missing permission: platform.entitlement.manage</p>
      ) : null}
      {error ? <p className={styles.error}>{error}</p> : null}

      <ForgePageSection title="Upcoming / scheduled renewals">
        {loading ? <p className={styles.muted}>Loading…</p> : null}
        {!loading && canRead && renewals.length === 0 ? (
          <p className={styles.error} role="status">
            CONDITION: No renewal or end-date fields available on subscriptions for this customer.
          </p>
        ) : null}
        {!loading && renewals.length > 0 ? (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Plan</th>
                <th>Status</th>
                <th>Renewal / end</th>
                <th>Billing</th>
              </tr>
            </thead>
            <tbody>
              {renewals.map(({ row, renewalAt }) => (
                <tr key={row.id}>
                  <td>{row.planCode ?? "—"}</td>
                  <td>
                    <ForgeStatusBadge status={row.status} />
                  </td>
                  <td>{renewalAt ? new Date(renewalAt).toLocaleString() : "—"}</td>
                  <td>{row.billingCycle ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </ForgePageSection>
    </CreatorPage>
  );
}

export default function BillingRenewalsPage() {
  return (
    <Suspense fallback={<CreatorLoading />}>
      <RenewalsInner />
    </Suspense>
  );
}
