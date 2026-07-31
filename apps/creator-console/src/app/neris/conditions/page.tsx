"use client";

import { useCallback, useEffect, useState } from "react";
import { ListControls } from "@/components/list-controls";
import { NerisPageShell } from "@/components/neris-schema-gate";
import { apiGet } from "@/lib/api";
import styles from "../../page.module.css";

type ConditionRow = {
  condition: {
    id: string;
    conditionKind: string;
    rawExpression: string | null;
    parseStatus: string;
    ruleJson: unknown;
  };
  fieldKey: string;
};

export default function NerisConditionsPage() {
  const [items, setItems] = useState<ConditionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [parseStatus, setParseStatus] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "25" });
      if (search) params.set("search", search);
      if (parseStatus) params.set("parseStatus", parseStatus);
      setItems(await apiGet<ConditionRow[]>(`/api/v1/platform/neris/conditions?${params}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load conditions");
    } finally {
      setLoading(false);
    }
  }, [page, search, parseStatus]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <NerisPageShell
      title="NERIS conditions"
      subtitle="Raw possible_if expressions and safe structured rule trees (no eval)."
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
        filter={parseStatus}
        onFilterChange={(value) => {
          setParseStatus(value);
          setPage(1);
        }}
        filterOptions={[
          { value: "", label: "All parse statuses" },
          { value: "PARSED", label: "PARSED" },
          { value: "NEEDS_REVIEW", label: "NEEDS_REVIEW" },
          { value: "EMPTY", label: "EMPTY" },
        ]}
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
              <th>Kind</th>
              <th>Status</th>
              <th>Raw</th>
              <th>Rule</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.condition.id}>
                <td>
                  <code>{row.fieldKey}</code>
                </td>
                <td>{row.condition.conditionKind}</td>
                <td>{row.condition.parseStatus}</td>
                <td>{row.condition.rawExpression ?? "—"}</td>
                <td>
                  <code>{JSON.stringify(row.condition.ruleJson)}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </NerisPageShell>
  );
}
