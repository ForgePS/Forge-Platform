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
import { productDisplayName } from "@/lib/presentation";
import styles from "../page.module.css";

type CatalogProduct = { id: string; code: string; name: string; status?: string };
type CatalogModule = { id: string; code: string; name: string; status?: string };

function humanModuleStatus(status: string): string {
  return status === "ACTIVE" ? "Active" : status.replace(/_/g, " ");
}

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
        subtitle="Forge products customers can use. Module catalog is available under Modules."
      />

      {error ? <ErrorState title="Unable to load products" description={error} /> : null}
      {loading ? <LoadingState label="Loading products…" /> : null}

      <div className={styles.panel}>
        <h2>Product catalog</h2>
        <ListControls
          search={search}
          onSearchChange={setSearch}
          sort={sort}
          sortOptions={[
            { value: "name", label: "Name" },
            { value: "code", label: "Internal code" },
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
          <div className={styles.productCardGrid}>
            {pageItems.map((row) => (
              <div key={row.id} className={styles.productCard}>
                <strong>{row.name || productDisplayName(row.code)}</strong>
                <span className={styles.muted}>Status: {row.status ?? "Active"}</span>
              </div>
            ))}
          </div>
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
                meta={row.status ? humanModuleStatus(row.status) : "Available"}
                href="/modules/"
                disabled
                disabledReason="Open Modules to manage assignments"
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
