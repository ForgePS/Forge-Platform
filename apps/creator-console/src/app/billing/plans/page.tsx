"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { ForgePageSection } from "@forge/ui";
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
};

const PLAN_FIELD_REFERENCE = [
  { field: "planCode", description: "Stable identifier used on subscriptions (e.g. IND-STD)." },
  { field: "displayName", description: "Customer-facing plan name." },
  { field: "productCode", description: "Product the plan belongs to (Industrial, RMS, Academy)." },
  { field: "billingCycle", description: "MONTHLY | ANNUAL | CUSTOM." },
  { field: "currency", description: "ISO currency code when priced." },
  { field: "status", description: "ACTIVE | DEPRECATED | DRAFT." },
] as const;

function PlansInner() {
  const tenantId = useTenantId();
  const { hasPermission } = useAuth();
  const canRead = hasPermission("platform.entitlement.manage");
  const [current, setCurrent] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(Boolean(tenantId));

  const load = useCallback(async () => {
    if (!tenantId || !canRead) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const row = await apiGet<Subscription>(
        `/api/v1/tenants/${tenantId}/subscriptions/current`,
      ).catch(() => null);
      setCurrent(row);
    } finally {
      setLoading(false);
    }
  }, [tenantId, canRead]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!tenantId) {
    return (
      <CreatorPage title="Plans">
        <TenantRequired />
        <p className={styles.muted} style={{ marginTop: "1rem" }}>
          CONDITION: Plans catalog API not available. Select a customer tenant to see planCode from
          the current subscription when one exists.
        </p>
        <Link className="forge-btn forge-btn--secondary" href="/billing">
          Back to Billing
        </Link>
      </CreatorPage>
    );
  }

  return (
    <CreatorPage
      title="Plans"
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
      <p className={styles.error} role="status">
        CONDITION: Plans catalog API not available. Plan fields below are reference only.
      </p>

      <ForgePageSection title="Plan field reference">
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Field</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {PLAN_FIELD_REFERENCE.map((row) => (
              <tr key={row.field}>
                <td className={styles.mono}>{row.field}</td>
                <td>{row.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ForgePageSection>

      <ForgePageSection title="Current subscription plan">
        {loading ? <p className={styles.muted}>Loading…</p> : null}
        {!loading && !current ? (
          <p className={styles.muted}>No current subscription for this customer.</p>
        ) : null}
        {current ? (
          <dl className={styles.dl}>
            <dt>planCode</dt>
            <dd className={styles.mono}>{current.planCode ?? "—"}</dd>
            <dt>Status</dt>
            <dd>{current.status}</dd>
            <dt>Billing cycle</dt>
            <dd>{current.billingCycle ?? "—"}</dd>
          </dl>
        ) : null}
      </ForgePageSection>
    </CreatorPage>
  );
}

export default function BillingPlansPage() {
  return (
    <Suspense fallback={<CreatorLoading />}>
      <PlansInner />
    </Suspense>
  );
}
