"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useAuth } from "@forge/web-kit";
import { FeatureGate } from "@/components/feature-gate";
import {
  listCadUnmappedValues,
  resolveCadUnmappedValue,
  type CadUnmappedValue,
} from "@/lib/rms-api";
import styles from "../../page.module.css";

function CadUnmappedInner() {
  const { me } = useAuth();
  const [items, setItems] = useState<CadUnmappedValue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!me?.tenantId) return;
    setLoading(true);
    setError(null);
    try {
      setItems(await listCadUnmappedValues(me.tenantId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load unmapped values");
    } finally {
      setLoading(false);
    }
  }, [me?.tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function resolve(row: CadUnmappedValue, status: "MAPPED" | "IGNORED_WITH_REASON") {
    if (!me?.tenantId) return;
    setError(null);
    try {
      await resolveCadUnmappedValue(me.tenantId, row.id, {
        status,
        resolutionReason: `Resolved from unmapped UI as ${status}`,
        recordVersion: row.recordVersion,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resolve unmapped value");
    }
  }

  return (
    <FeatureGate flag="cadEnabled" title="CAD Unmapped Values">
      <section className={styles.page}>
        <h1>Unmapped CAD values</h1>
        <p className={styles.lead}>Call types and other dictionary values needing mapping.</p>
        {error ? <p className={styles.error}>{error}</p> : null}
        <div className={styles.panel}>
          {loading ? <p className={styles.muted}>Loading…</p> : null}
          {!loading && items.length === 0 ? (
            <p className={styles.muted}>No unmapped values.</p>
          ) : null}
          {items.length > 0 ? (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Field</th>
                  <th>Value</th>
                  <th>Count</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id}>
                    <td>{row.category}</td>
                    <td className={styles.mono}>{row.sourceField}</td>
                    <td>{row.sourceValue}</td>
                    <td className={styles.mono}>{row.occurrenceCount}</td>
                    <td>{row.status}</td>
                    <td>
                      {row.status === "OPEN" ? (
                        <div className={styles.actions}>
                          <button
                            type="button"
                            className={styles.buttonSecondary}
                            onClick={() => void resolve(row, "MAPPED")}
                          >
                            Mark mapped
                          </button>
                          <button
                            type="button"
                            className={styles.buttonSecondary}
                            onClick={() => void resolve(row, "IGNORED_WITH_REASON")}
                          >
                            Ignore
                          </button>
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>
      </section>
    </FeatureGate>
  );
}

export default function CadUnmappedPage() {
  return (
    <Suspense fallback={<p className={styles.muted}>Loading…</p>}>
      <CadUnmappedInner />
    </Suspense>
  );
}
