"use client";

import { ErrorState, ForgeStatusBadge } from "@/components/creator-page";

import { useCallback, useEffect, useState } from "react";
import { NerisPageShell } from "@/components/neris-schema-gate";
import { apiGet } from "@/lib/api";
import styles from "../../page.module.css";

type Version = {
  id: string;
  versionLabel: string;
  state: string;
  checksumSha256: string;
  moduleCount: number;
  fieldCount: number;
  valueSetCount: number;
  optionCount: number;
  publishedAt: string | null;
};

export default function NerisVersionsPage() {
  const [items, setItems] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await apiGet<Version[]>("/api/v1/platform/neris/versions?pageSize=50"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't load this information.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <NerisPageShell title="NERIS versions" subtitle="Published and staged schema versions.">
      {loading ? <p>Loading…</p> : null}
      {error ? (
        <ErrorState title="We couldn't load this information." description={error} />
      ) : null}
      {!loading && !error && items.length === 0 ? <p>No versions found.</p> : null}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Label</th>
              <th>State</th>
              <th>Modules</th>
              <th>Fields</th>
              <th>Value sets</th>
              <th>Options</th>
              <th>Published</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.id}>
                <td>{row.versionLabel}</td>
                <td><ForgeStatusBadge status={row.state} /></td>
                <td>{row.moduleCount}</td>
                <td>{row.fieldCount}</td>
                <td>{row.valueSetCount}</td>
                <td>{row.optionCount}</td>
                <td>{row.publishedAt ? new Date(row.publishedAt).toLocaleString() : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </NerisPageShell>
  );
}
