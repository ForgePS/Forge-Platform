"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useAuth } from "@forge/web-kit";
import { FeatureGate } from "@/components/feature-gate";
import { getCadOperationsSummary, type CadOperationsSummary } from "@/lib/rms-api";
import styles from "../../page.module.css";

function CadOperationsInner() {
  const { me } = useAuth();
  const [summary, setSummary] = useState<CadOperationsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!me?.tenantId) return;
    setLoading(true);
    setError(null);
    try {
      setSummary(await getCadOperationsSummary(me.tenantId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load CAD operations");
    } finally {
      setLoading(false);
    }
  }, [me?.tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <FeatureGate flag="cadOperations" title="CAD Operations">
      <section className={styles.page}>
        <h1>CAD operations</h1>
        <p className={styles.lead}>
          Intake health, conflicts, and mapping queues. Raw payloads are never shown here.
        </p>
        {error ? <p className={styles.error}>{error}</p> : null}
        {loading ? <p className={styles.muted}>Loading…</p> : null}
        {summary ? (
          <>
            <div className={styles.panel}>
              <h2>Pipeline</h2>
              <table className={styles.table}>
                <tbody>
                  <tr>
                    <td>Messages received</td>
                    <td className={styles.mono}>{summary.messages.received}</td>
                  </tr>
                  <tr>
                    <td>Applied</td>
                    <td className={styles.mono}>{summary.messages.applied}</td>
                  </tr>
                  <tr>
                    <td>Duplicates</td>
                    <td className={styles.mono}>{summary.messages.duplicates}</td>
                  </tr>
                  <tr>
                    <td>Failed</td>
                    <td className={styles.mono}>{summary.messages.failed}</td>
                  </tr>
                  <tr>
                    <td>Dead letter</td>
                    <td className={styles.mono}>{summary.messages.deadLetter}</td>
                  </tr>
                  <tr>
                    <td>Requires review</td>
                    <td className={styles.mono}>{summary.messages.requiresReview}</td>
                  </tr>
                  <tr>
                    <td>Active CAD links</td>
                    <td className={styles.mono}>{summary.activeLinks}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className={styles.panel}>
              <h2>Queues</h2>
              <ul>
                <li>
                  <Link href="/cad/conflicts/">Open conflicts: {summary.openConflicts}</Link>
                </li>
                <li>
                  <Link href="/cad/unmapped/">Unmapped values: {summary.unmappedValues}</Link>
                </li>
                <li>
                  <Link href="/cad/mappings/">Unknown units: {summary.unknownUnits}</Link>
                </li>
                <li>
                  <Link href="/cad/mappings/">Unknown personnel: {summary.unknownPersonnel}</Link>
                </li>
                <li>
                  <Link href="/cad/messages/">Recent message metadata</Link>
                </li>
              </ul>
            </div>
            <div className={styles.panel}>
              <h2>Connections</h2>
              {summary.connections.length === 0 ? (
                <p className={styles.muted}>
                  No connections yet. <Link href="/cad/connections/">Configure CAD</Link>
                </p>
              ) : (
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Status</th>
                      <th>Health</th>
                      <th>Transport</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.connections.map((row) => (
                      <tr key={row.id}>
                        <td>{row.name}</td>
                        <td>{row.status}</td>
                        <td>{row.healthStatus}</td>
                        <td className={styles.mono}>{row.transportType}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        ) : null}
      </section>
    </FeatureGate>
  );
}

export default function CadOperationsPage() {
  return (
    <Suspense fallback={<p className={styles.muted}>Loading…</p>}>
      <CadOperationsInner />
    </Suspense>
  );
}
