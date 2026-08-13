"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import {
  EmptyState,
  ErrorState,
  FilterBar,
  ForgeModuleGrid,
  ForgePageHeader,
  LoadingState,
  ModuleCard,
  SearchInput,
} from "@forge/ui";
import { PlatformPageGate } from "@/components/platform-page-gate";
import { apiGet } from "@/lib/api";
import styles from "../page.module.css";

type CatalogModule = { id: string; code: string; name: string; status?: string };

function ModulesInner() {
  const [modules, setModules] = useState<CatalogModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

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

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return modules;
    return modules.filter((row) =>
      [row.code, row.name, row.id, row.status ?? ""].join(" ").toLowerCase().includes(needle),
    );
  }, [modules, search]);

  return (
    <section className={styles.page}>
      <ForgePageHeader
        title="Modules"
        subtitle="Platform module catalog (control plane)."
      />

      {error ? <ErrorState title="Unable to load modules" description={error} /> : null}

      <FilterBar>
        <SearchInput value={search} onChange={setSearch} placeholder="Search modules…" />
      </FilterBar>

      {loading ? <LoadingState label="Loading modules…" /> : null}
      {!loading && filtered.length === 0 ? (
        <EmptyState title="No modules found" description="Adjust your search or check the platform catalog." />
      ) : null}

      {filtered.length > 0 ? (
        <ForgeModuleGrid>
          {filtered.map((row) => (
            <ModuleCard
              key={row.id}
              name={row.name}
              meta={`${row.code}${row.status ? ` · ${row.status}` : ""}`}
              href="/modules/"
              disabled
              disabledReason={row.id}
            />
          ))}
        </ForgeModuleGrid>
      ) : null}
    </section>
  );
}

export default function ModulesPage() {
  return (
    <PlatformPageGate title="Modules" permission="platform.entitlement.manage">
      <Suspense fallback={<LoadingState label="Loading…" />}>
        <ModulesInner />
      </Suspense>
    </PlatformPageGate>
  );
}
