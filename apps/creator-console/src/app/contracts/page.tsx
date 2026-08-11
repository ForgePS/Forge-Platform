"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { PlatformPageGate } from "@/components/platform-page-gate";
import { TenantRequired } from "@/components/tenant-required";
import { tenantQuery, useTenantId } from "@/hooks/use-tenant-id";
import { apiGet } from "@/lib/api";
import styles from "../page.module.css";

type Contract = {
  id: string;
  name: string;
  status: string;
  billingType: string;
  startsOn: string | null;
  endsOn: string | null;
  renewalOn: string | null;
  setupFeeCents: number | null;
  notes: string | null;
};

type Overview = {
  contracts: Contract[];
};

function ContractsInner() {
  const tenantId = useTenantId();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(Boolean(tenantId));
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const overview = await apiGet<Overview>(`/api/v1/tenants/${tenantId}/billing/overview`);
      setContracts(overview.contracts ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load contracts");
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
        <h1>Contracts</h1>
        <TenantRequired />
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <h1>Contracts</h1>
      <p className={styles.lead}>
        Tenant commercial contracts · <span className={styles.mono}>{tenantId}</span> ·{" "}
        <Link href={`/billing${tenantQuery(tenantId)}`}>Billing</Link>
      </p>

      {error ? <p className={styles.error}>{error}</p> : null}
      {loading ? <p className={styles.muted}>Loading…</p> : null}

      <div className={styles.panel}>
        {!loading && contracts.length === 0 ? (
          <p className={styles.muted}>No contracts for this tenant.</p>
        ) : null}
        {contracts.length > 0 ? (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Type</th>
                <th>Starts</th>
                <th>Ends</th>
                <th>Renewal</th>
                <th>Setup fee</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((row) => (
                <tr key={row.id}>
                  <td>{row.name}</td>
                  <td>{row.status}</td>
                  <td className={styles.mono}>{row.billingType}</td>
                  <td>{row.startsOn ?? "—"}</td>
                  <td>{row.endsOn ?? "—"}</td>
                  <td>{row.renewalOn ?? "—"}</td>
                  <td>
                    {row.setupFeeCents != null
                      ? `$${(row.setupFeeCents / 100).toFixed(2)}`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>
    </section>
  );
}

export default function ContractsPage() {
  return (
    <PlatformPageGate
      title="Contracts"
      anyOf={["platform.entitlement.manage", "tenant.billing.read"]}
    >
      <Suspense fallback={<p className={styles.muted}>Loading…</p>}>
        <ContractsInner />
      </Suspense>
    </PlatformPageGate>
  );
}
