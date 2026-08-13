"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import {
  ForgePageContainer,
  ForgePageHeader,
  ForgePageSection,
  ForgeStatusBadge,
  ForgeToolbar,
} from "@forge/ui";
import { filterBySearch, ListControls, paginate, sortByField } from "@/components/list-controls";
import { apiGet } from "@/lib/api";
import styles from "../page.module.css";

type CatalogProduct = { id: string; code: string; name: string; status?: string };
type CatalogModule = {
  id: string;
  code: string;
  name: string;
  status?: string;
  productId?: string;
};

const PAGE_SIZE = 10;

function ProductsInner() {
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [modules, setModules] = useState<CatalogModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("code");
  const [page, setPage] = useState(1);
  const [moduleSearch, setModuleSearch] = useState("");
  const [modulePage, setModulePage] = useState(1);

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

  useEffect(() => {
    setModulePage(1);
  }, [moduleSearch]);

  const filtered = useMemo(() => {
    const searched = filterBySearch(products, search, [
      (row) => row.code,
      (row) => row.name,
    ]);
    return sortByField(searched, sort, {
      code: (row) => row.code,
      name: (row) => row.name,
    });
  }, [products, search, sort]);

  const pageItems = paginate(filtered, page, PAGE_SIZE);

  const filteredModules = useMemo(
    () =>
      filterBySearch(modules, moduleSearch, [
        (row) => row.code,
        (row) => row.name,
      ]),
    [modules, moduleSearch],
  );
  const modulePageItems = paginate(filteredModules, modulePage, PAGE_SIZE);

  return (
    <ForgePageContainer>
      <ForgePageHeader
        title="Product Catalog"
        subtitle="Platform product and module catalog from the live API."
      />

      {error ? <p className={styles.error}>{error}</p> : null}
      {loading ? <p className={styles.muted}>Loading…</p> : null}

      <ForgePageSection title="Products" description="Commercial Forge products available to entitle.">
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
                <th>Name</th>
                <th>Code</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((row) => (
                <tr key={row.id}>
                  <td>{row.name}</td>
                  <td className={styles.mono}>{row.code}</td>
                  <td>
                    <ForgeStatusBadge status={row.status ?? "ACTIVE"} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </ForgePageSection>

      <ForgePageSection title="Modules" description="Modules across all products.">
        <ForgeToolbar>
          <input
            className="forge-input"
            type="search"
            placeholder="Search modules..."
            value={moduleSearch}
            onChange={(e) => setModuleSearch(e.target.value)}
            aria-label="Search modules"
          />
        </ForgeToolbar>
        {filteredModules.length === 0 ? (
          <p className={styles.muted}>No modules in catalog.</p>
        ) : (
          <>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Code</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {modulePageItems.map((row) => (
                  <tr key={row.id}>
                    <td>{row.name}</td>
                    <td className={styles.mono}>{row.code}</td>
                    <td>
                      <ForgeStatusBadge status={row.status ?? "ACTIVE"} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className={styles.pagination}>
              <span className={styles.muted}>
                Showing{" "}
                {filteredModules.length === 0
                  ? 0
                  : (modulePage - 1) * PAGE_SIZE + 1}
                –
                {Math.min(modulePage * PAGE_SIZE, filteredModules.length)} of{" "}
                {filteredModules.length}
              </span>
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.buttonSecondary}
                  disabled={modulePage <= 1}
                  onClick={() => setModulePage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className={styles.buttonSecondary}
                  disabled={modulePage * PAGE_SIZE >= filteredModules.length}
                  onClick={() => setModulePage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </ForgePageSection>
    </ForgePageContainer>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<p className={styles.muted}>Loading…</p>}>
      <ProductsInner />
    </Suspense>
  );
}
