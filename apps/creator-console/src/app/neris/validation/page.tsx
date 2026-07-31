"use client";

import { useCallback, useEffect, useState } from "react";
import { NerisPageShell } from "@/components/neris-schema-gate";
import { apiGet } from "@/lib/api";
import styles from "../../page.module.css";

type Integrity = {
  ok: boolean;
  counts: { modules: number; fields: number; valueSets: number; options: number };
  expected: { modules: number; fields: number; valueSets: number; options: number };
  issues: Array<{ code: string; severity: string; message: string }>;
};

type ValidationBundle = {
  schemaVersionId: string;
  items: Array<{
    id: string;
    severity: string;
    code: string;
    message: string;
    resourceKey: string | null;
  }>;
};

export default function NerisValidationPage() {
  const [integrity, setIntegrity] = useState<Integrity | null>(null);
  const [results, setResults] = useState<ValidationBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [live, stored] = await Promise.all([
        apiGet<Integrity>("/api/v1/platform/neris/integrity"),
        apiGet<ValidationBundle>("/api/v1/platform/neris/validation-results"),
      ]);
      setIntegrity(live);
      setResults(stored);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load validation");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <NerisPageShell
      title="NERIS validation"
      subtitle="Import validation results and live integrity counts."
    >
      {loading ? <p>Loading…</p> : null}
      {error ? <p className={styles.error}>{error}</p> : null}
      {integrity ? (
        <div className={styles.panel}>
          <h2>Live integrity {integrity.ok ? "OK" : "ISSUES"}</h2>
          <p>
            Modules {integrity.counts.modules}/{integrity.expected.modules} · Fields{" "}
            {integrity.counts.fields}/{integrity.expected.fields} · Value sets{" "}
            {integrity.counts.valueSets}/{integrity.expected.valueSets} · Options{" "}
            {integrity.counts.options}/{integrity.expected.options}
          </p>
          {integrity.issues.length === 0 ? <p>No live integrity issues.</p> : null}
          <ul>
            {integrity.issues.map((issue) => (
              <li key={issue.code}>
                [{issue.severity}] {issue.code}: {issue.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {results ? (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Severity</th>
                <th>Code</th>
                <th>Message</th>
                <th>Resource</th>
              </tr>
            </thead>
            <tbody>
              {results.items.map((row) => (
                <tr key={row.id}>
                  <td>{row.severity}</td>
                  <td>{row.code}</td>
                  <td>{row.message}</td>
                  <td>{row.resourceKey ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </NerisPageShell>
  );
}
