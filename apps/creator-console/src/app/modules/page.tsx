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

type CatalogModule = { id: string; code: string; name: string; status?: string };

const PAGE_SIZE = 20;

function ModulesInner() {
  const [modules, setModules] = useState<CatalogModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("code");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setModules(await apiGet<CatalogModule[]>("/api/v1/platform/modules"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load modules");
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
    const searched = filterBySearch(modules, search, [
      (row) => row.code,
      (row) => row.name,
      (row) => row.id,
    ]);
    return sortByField(searched, sort, {
      code: (row) => row.code,
      name: (row) => row.name,
    });
  }, [modules, search, sort]);

  const pageItems = paginate(filtered, page, PAGE_SIZE);

  return (
    <section className={styles.page}>
      <h1>Modules</h1>
      <p className={styles.lead}>Platform module catalog (control plane).</p>

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
          ]}
          onSortChange={setSort}
          page={page}
          pageSize={PAGE_SIZE}
          total={filtered.length}
          onPageChange={setPage}
        />
        {!loading && filtered.length === 0 ? (
          <p className={styles.muted}>No modules found.</p>
        ) : null}
        {pageItems.length > 0 ? (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Status</th>
                <th>ID</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((row) => (
                <tr key={row.id}>
                  <td className={styles.mono}>{row.code}</td>
                  <td>{row.name}</td>
                  <td>{row.status ?? "—"}</td>
                  <td className={styles.mono}>{row.id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>
    </section>
  );
}

export default function ModulesPage() {
  return (
    <PlatformPageGate title="Modules" permission="platform.entitlement.manage">
      <Suspense fallback={<p className={styles.muted}>Loading…</p>}>
        <ModulesInner />
      </Suspense>
    </PlatformPageGate>
  );
}
