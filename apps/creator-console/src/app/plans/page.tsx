"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import {
  filterBySearch,
  ListControls,
  paginate,
  sortByField,
} from "@/components/list-controls";
import { PlatformPageGate } from "@/components/platform-page-gate";
import { apiGet } from "@/lib/api";
import styles from "../page.module.css";

type CatalogPlan = {
  id: string;
  code: string;
  name: string;
  billingInterval: string;
  status?: string;
  basePriceCents: number | null;
  currency: string;
};

const PAGE_SIZE = 20;

function PlansInner() {
  const [plans, setPlans] = useState<CatalogPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("code");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPlans(await apiGet<CatalogPlan[]>("/api/v1/platform/plans"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load plans");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [search, sort]);

  const filtered = useMemo(() => {
    const searched = filterBySearch(plans, search, [
      (row) => row.code,
      (row) => row.name,
      (row) => row.billingInterval,
      (row) => row.id,
    ]);
    return sortByField(searched, sort, {
      code: (row) => row.code,
      name: (row) => row.name,
      price: (row) => row.basePriceCents ?? 0,
    });
  }, [plans, search, sort]);

  const pageItems = paginate(filtered, page, PAGE_SIZE);

  return (
    <section className={styles.page}>
      <h1>Plans</h1>
      <p className={styles.lead}>Subscription plan catalog from the live platform API.</p>

      {error ? <p className={styles.error}>{error}</p> : null}
      {loading ? <p className={styles.muted}>Loading…</p> : null}

      <div className={styles.panel}>
        <ListControls
          search={search}
          onSearchChange={setSearch}
          sort={sort}
          sortOptions={[
            { value: "code", label: "Code" },
            { value: "name", label: "Name" },
            { value: "price", label: "Price" },
          ]}
          onSortChange={setSort}
          page={page}
          pageSize={PAGE_SIZE}
          total={filtered.length}
          onPageChange={setPage}
        />
        {!loading && filtered.length === 0 ? (
          <p className={styles.muted}>No plans found.</p>
        ) : null}
        {pageItems.length > 0 ? (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Interval</th>
                <th>Base price</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((row) => (
                <tr key={row.id}>
                  <td className={styles.mono}>{row.code}</td>
                  <td>{row.name}</td>
                  <td>{row.billingInterval}</td>
                  <td>
                    {row.basePriceCents != null
                      ? `${(row.basePriceCents / 100).toFixed(2)} ${row.currency}`
                      : "—"}
                  </td>
                  <td>{row.status ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>
    </section>
  );
}

export default function PlansPage() {
  return (
    <PlatformPageGate title="Plans" permission="platform.entitlement.manage">
      <Suspense fallback={<p className={styles.muted}>Loading…</p>}>
        <PlansInner />
      </Suspense>
    </PlatformPageGate>
  );
}
