"use client";

import { useCallback, useEffect, useState } from "react";
import { ListControls } from "@/components/list-controls";
import { NerisPageShell } from "@/components/neris-schema-gate";
import { apiGet } from "@/lib/api";
import styles from "../../page.module.css";

type MappingRow = {
  mapping: {
    id: string;
    mapOrmLanding: string | null;
    mapApp: string | null;
    payloadPath: string | null;
    immutableOfficial: boolean;
  };
  fieldKey: string;
};

export default function NerisMappingsPage() {
  const [items, setItems] = useState<MappingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "25" });
      if (search) params.set("search", search);
      setItems(await apiGet<MappingRow[]>(`/api/v1/platform/neris/mappings?${params}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load mappings");
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <NerisPageShell
      title="NERIS mappings"
      subtitle="Official payload / ORM mappings are read-only after publish."
    >
      {loading ? <p>Loading…</p> : null}
      {error ? <p className={styles.error}>{error}</p> : null}
      <ListControls
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        sort="field"
        sortOptions={[{ value: "field", label: "Field" }]}
        onSortChange={() => undefined}
        page={page}
        pageSize={25}
        total={items.length}
        onPageChange={setPage}
      />
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Field</th>
              <th>ORM landing</th>
              <th>App map</th>
              <th>Payload path</th>
              <th>Immutable</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.mapping.id}>
                <td>
                  <code>{row.fieldKey}</code>
                </td>
                <td>{row.mapping.mapOrmLanding ?? "—"}</td>
                <td>{row.mapping.mapApp ?? "—"}</td>
                <td>{row.mapping.payloadPath ?? "—"}</td>
                <td>{row.mapping.immutableOfficial ? "yes" : "no"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </NerisPageShell>
  );
}
