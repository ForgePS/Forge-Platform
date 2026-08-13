"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import {
  ErrorState,
  ForgeModuleGrid,
  ForgePageHeader,
  LoadingState,
  ModuleCard,
} from "@forge/ui";
import {
  filterBySearch,
  ListControls,
  paginate,
  sortByField,
} from "@/components/list-controls";
import { PlatformPageGate } from "@/components/platform-page-gate";
import { apiGet } from "@/lib/api";
import styles from "../page.module.css";

type CatalogProduct = { id: string; code: string; name: string; status?: string };
type CatalogModule = { id: string; code: string; name: string; status?: string };

const PAGE_SIZE = 10;

function ProductsInner() {
  const [products, setProducts] = useState<CatalogProduct[]>([]);
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
      const [productRows, moduleRows] = await Promise.all([
        apiGet<CatalogProduct[]>("/api/v1/platform/products"),
        apiGet<CatalogModule[]>("/api/v1/platform/modules"),
      ]);
      setProducts(productRows);
      setModules(moduleRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load catalog");
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
    const searched = filterBySearch(products, search, [
      (row) => row.code,
      (row) => row.name,
      (row) => row.id,
    ]);
    return sortByField(searched, sort, {
      code: (row) => row.code,
      name: (row) => row.name,
    });
  }, [products, search, sort]);

  const pageItems = paginate(filtered, page, PAGE_SIZE);

  return (
    <section className={styles.page}>
      <ForgePageHeader
        title="Products"
        subtitle="Platform product and module catalog from the live API."
      />

      {error ? <ErrorState title="Unable to load catalog" description={error} /> : null}
      {loading ? <LoadingState label="Loading catalog…" /> : null}

      <div className={styles.panel}>
        <h2>Products</h2>
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
          <p className={styles.muted}>No products found.</p>
        ) : null}
        {pageItems.length > 0 ? (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>ID</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((row) => (
                <tr key={row.id}>
                  <td className={styles.mono}>{row.code}</td>
                  <td>{row.name}</td>
                  <td className={styles.mono}>{row.id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>

      <div className={styles.panel}>
        <h2>Modules</h2>
        {modules.length === 0 ? (
          <p className={styles.muted}>No modules in catalog.</p>
        ) : (
          <ForgeModuleGrid>
            {modules.map((row) => (
              <ModuleCard
                key={row.id}
                name={row.name}
                meta={`${row.code}${row.status ? ` · ${row.status}` : ""} · ${row.id}`}
                href="/modules/"
                disabled
                disabledReason="Catalog entry"
              />
            ))}
          </ForgeModuleGrid>
        )}
      </div>
    </section>
  );
}

export default function ProductsPage() {
  return (
    <PlatformPageGate title="Products" permission="platform.entitlement.manage">
      <Suspense fallback={<LoadingState label="Loading…" />}>
        <ProductsInner />
      </Suspense>
    </PlatformPageGate>
  );
}
