"use client";

import {
  CreatorLoading,
  CreatorPage,
  ForgePageSection,
  ForgeStatusBadge,
} from "@/components/creator-page";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { filterBySearch, ListControls, paginate, sortByField } from "@/components/list-controls";
import { TenantRequired } from "@/components/tenant-required";
import { useAuth } from "@/hooks/use-auth";
import { tenantQuery, useTenantId, tenantDetailHref } from "@/hooks/use-tenant-id";
import { apiGet } from "@/lib/api";
import styles from "../page.module.css";

type Subscription = {
  id: string;
  status: string;
  planCode: string | null;
  billingCycle: string | null;
  startedAt: string | null;
  endsAt: string | null;
  createdAt: string;
};

const PAGE_SIZE = 10;

function SubscriptionsInner() {
  const tenantId = useTenantId();
  const { hasPermission } = useAuth();
  const canRead = hasPermission("platform.entitlement.manage");

  const [items, setItems] = useState<Subscription[]>([]);
  const [current, setCurrent] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(Boolean(tenantId));
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("created-desc");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    if (!tenantId || !canRead) return;
    setLoading(true);
    setError(null);
    try {
      const [rows, currentRow] = await Promise.all([
        apiGet<Subscription[]>(`/api/v1/tenants/${tenantId}/subscriptions`),
        apiGet<Subscription>(`/api/v1/tenants/${tenantId}/subscriptions/current`).catch(() => null),
      ]);
      setItems(rows);
      setCurrent(currentRow);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't load this information.");
    } finally {
      setLoading(false);
    }
  }, [tenantId, canRead]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [search, sort]);

  const filtered = useMemo(() => {
    const searched = filterBySearch(items, search, [
      (row) => row.status,
      (row) => row.planCode ?? "",
      (row) => row.id,
    ]);
    return sortByField(searched, sort, {
      "created-desc": (row) => -Date.parse(row.createdAt),
      status: (row) => row.status,
      plan: (row) => row.planCode ?? "",
    });
  }, [items, search, sort]);

  const pageItems = paginate(filtered, page, PAGE_SIZE);

  if (!tenantId) {
    return (
      <CreatorPage title="Subscriptions">
        <TenantRequired />
      </CreatorPage>
    );
  }

  return (
    <CreatorPage
      title="Subscriptions"
      subtitle={<><Link href={tenantDetailHref(tenantId)}>Back to Customer</Link> ·{" "}<Link href={`/entitlements${tenantQuery(tenantId)}`}>Entitlements</Link></>}
      >

      {!canRead ? (
        <p className={styles.error}>Missing permission: platform.entitlement.manage</p>
      ) : null}
      {error ? <p className={styles.error}>{error}</p> : null}

      <ForgePageSection title="Current subscription">
        {loading ? <p className={styles.muted}>Loading…</p> : null}
        {!loading && !current ? <p className={styles.muted}>No current subscription.</p> : null}
        {current ? (
          <dl className={styles.dl}>
            <dt>ID</dt>
            <dd className={styles.mono}>{current.id}</dd>
            <dt>Status</dt>
            <dd><ForgeStatusBadge status={current.status} /></dd>
            <dt>Plan</dt>
            <dd>{current.planCode ?? "—"}</dd>
            <dt>Billing cycle</dt>
            <dd>{current.billingCycle ?? "—"}</dd>
          </dl>
        ) : null}
      </ForgePageSection>

      <ForgePageSection title="All subscriptions">
        {canRead ? (
          <ListControls
            search={search}
            onSearchChange={setSearch}
            sort={sort}
            sortOptions={[
              { value: "created-desc", label: "Newest first" },
              { value: "status", label: "Status" },
              { value: "plan", label: "Plan" },
            ]}
            onSortChange={setSort}
            page={page}
            pageSize={PAGE_SIZE}
            total={filtered.length}
            onPageChange={setPage}
          />
        ) : null}
        {!loading && canRead && filtered.length === 0 ? (
          <p className={styles.muted}>No subscriptions found.</p>
        ) : null}
        {canRead && pageItems.length > 0 ? (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Status</th>
                <th>Plan</th>
                <th>Billing</th>
                <th>Started</th>
                <th>Ends</th>
                <th>ID</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((row) => (
                <tr key={row.id}>
                  <td><ForgeStatusBadge status={row.status} /></td>
                  <td>{row.planCode ?? "—"}</td>
                  <td>{row.billingCycle ?? "—"}</td>
                  <td className={styles.mono}>{row.startedAt ?? "—"}</td>
                  <td className={styles.mono}>{row.endsAt ?? "—"}</td>
                  <td className={styles.mono}>{row.id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </ForgePageSection>
    </CreatorPage>
  );
}

export default function SubscriptionsPage() {
  return (
    <Suspense fallback={<CreatorLoading />}>
      <SubscriptionsInner />
    </Suspense>
  );
}
