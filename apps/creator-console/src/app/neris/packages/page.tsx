"use client";

import { ErrorState, ForgeStatusBadge } from "@/components/creator-page";

import { useCallback, useEffect, useState } from "react";
import { NerisPageShell } from "@/components/neris-schema-gate";
import { apiGet } from "@/lib/api";
import styles from "../../page.module.css";

type ImportRow = {
  id: string;
  outcome: string;
  checksumSha256: string;
  moduleCount: number;
  fieldCount: number;
  valueSetCount: number;
  optionCount: number;
  createdAt: string;
};

type PackageRow = { id: string; code: string; name: string; status: string };

export default function NerisPackagesPage() {
  const [packages, setPackages] = useState<PackageRow[]>([]);
  const [imports, setImports] = useState<ImportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pkgs, history] = await Promise.all([
        apiGet<PackageRow[]>("/api/v1/platform/neris/packages"),
        apiGet<ImportRow[]>("/api/v1/platform/neris/imports?pageSize=25"),
      ]);
      setPackages(pkgs);
      setImports(history);
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
    <NerisPageShell
      title="NERIS packages"
      subtitle="Schema package identity and import history (read-only)."
    >
      {loading ? <p>Loading…</p> : null}
      {error ? (
        <ErrorState title="We couldn't load this information." description={error} />
      ) : null}
      {!loading && !error && packages.length === 0 ? <p>No packages imported yet.</p> : null}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {packages.map((row) => (
              <tr key={row.id}>
                <td>{row.code}</td>
                <td>{row.name}</td>
                <td><ForgeStatusBadge status={row.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2>Import history</h2>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>When</th>
              <th>Outcome</th>
              <th>Modules</th>
              <th>Fields</th>
              <th>Value sets</th>
              <th>Options</th>
              <th>Checksum</th>
            </tr>
          </thead>
          <tbody>
            {imports.map((row) => (
              <tr key={row.id}>
                <td>{new Date(row.createdAt).toLocaleString()}</td>
                <td>{row.outcome}</td>
                <td>{row.moduleCount}</td>
                <td>{row.fieldCount}</td>
                <td>{row.valueSetCount}</td>
                <td>{row.optionCount}</td>
                <td>
                  <code>{row.checksumSha256.slice(0, 12)}…</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </NerisPageShell>
  );
}
