"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useAuth } from "@forge/web-kit";
import { FeatureGate } from "@/components/feature-gate";
import { listCadConflicts, resolveCadConflict, type CadConflict } from "@/lib/rms-api";
import { FxTable } from "@/fx/tables/FxTable";
import { FxTableEmpty } from "@/fx/tables/FxTableStates";
import { TableSectionBoundary } from "@/fx/tables/TableSectionBoundary";
import { ensureTablesRegistered } from "@/fx/tables/register-all";
import { useRmsFxCadConflictsModule } from "@/fx/modules/use-cad-conflicts-module";
import styles from "../../page.module.css";

function CadConflictsInner() {
  const { me } = useAuth();
  const { list: listMode, loading: moduleFlagLoading } = useRmsFxCadConflictsModule();
  const [items, setItems] = useState<CadConflict[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ensureTablesRegistered();
  }, []);

  const load = useCallback(async () => {
    if (!me?.tenantId) return;
    setLoading(true);
    setError(null);
    try {
      setItems(await listCadConflicts(me.tenantId, { status: "OPEN" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load conflicts");
    } finally {
      setLoading(false);
    }
  }, [me?.tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function resolve(row: CadConflict, action: "KEEP_FORGE" | "USE_CAD" | "ESCALATE") {
    if (!me?.tenantId) return;
    setError(null);
    try {
      await resolveCadConflict(me.tenantId, row.id, {
        resolutionAction: action,
        resolutionReason: `Resolved from CAD conflicts UI as ${action}`,
        recordVersion: row.recordVersion,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resolve conflict");
    }
  }

  const useFx = !moduleFlagLoading && listMode === "fx";

  return (
    <FeatureGate flag="cadEnabled" title="CAD Conflicts">
      <section
        className={styles.page}
        data-testid={useFx ? "rms-fx-cad-conflicts" : "rms-legacy-cad-conflicts"}
      >
        <h1>CAD conflicts</h1>
        <p className={styles.lead}>Open match and field conflicts requiring operator review.</p>
        {error ? <p className={styles.error}>{error}</p> : null}
        {useFx ? (
          <TableSectionBoundary title="CAD conflicts">
            <FxTable
              caption="CAD conflicts"
              loading={loading}
              empty={
                <FxTableEmpty
                  title="No open conflicts."
                  description="Open match and field conflicts appear here for review."
                />
              }
              rows={items}
              rowKey={(row) => row.id}
              columns={[
                { id: "type", header: "Type", accessor: (row) => row.conflictType },
                { id: "severity", header: "Severity", accessor: (row) => row.severity },
                {
                  id: "field",
                  header: "Field",
                  accessor: (row) => (
                    <span className={styles.mono}>{row.fieldIdentifier ?? "—"}</span>
                  ),
                },
                {
                  id: "incident",
                  header: "Incident",
                  accessor: (row) =>
                    row.incidentId ? (
                      <Link href={`/incidents/${row.incidentId}/`}>
                        {row.incidentId.slice(0, 8)}…
                      </Link>
                    ) : (
                      "—"
                    ),
                },
              ]}
              rowActions={(row) => (
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.buttonSecondary}
                    onClick={() => void resolve(row, "KEEP_FORGE")}
                  >
                    Keep Forge
                  </button>
                  <button
                    type="button"
                    className={styles.buttonSecondary}
                    onClick={() => void resolve(row, "USE_CAD")}
                  >
                    Use CAD
                  </button>
                  <button
                    type="button"
                    className={styles.buttonSecondary}
                    onClick={() => void resolve(row, "ESCALATE")}
                  >
                    Escalate
                  </button>
                </div>
              )}
            />
          </TableSectionBoundary>
        ) : (
          <div className={styles.panel}>
            {loading ? <p className={styles.muted}>Loading…</p> : null}
            {!loading && items.length === 0 ? (
              <p className={styles.muted}>No open conflicts.</p>
            ) : null}
            {items.length > 0 ? (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Severity</th>
                    <th>Field</th>
                    <th>Incident</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr key={row.id}>
                      <td>{row.conflictType}</td>
                      <td>{row.severity}</td>
                      <td className={styles.mono}>{row.fieldIdentifier ?? "—"}</td>
                      <td>
                        {row.incidentId ? (
                          <Link href={`/incidents/${row.incidentId}/`}>
                            {row.incidentId.slice(0, 8)}…
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        <div className={styles.actions}>
                          <button
                            type="button"
                            className={styles.buttonSecondary}
                            onClick={() => void resolve(row, "KEEP_FORGE")}
                          >
                            Keep Forge
                          </button>
                          <button
                            type="button"
                            className={styles.buttonSecondary}
                            onClick={() => void resolve(row, "USE_CAD")}
                          >
                            Use CAD
                          </button>
                          <button
                            type="button"
                            className={styles.buttonSecondary}
                            onClick={() => void resolve(row, "ESCALATE")}
                          >
                            Escalate
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </div>
        )}
      </section>
    </FeatureGate>
  );
}

export default function CadConflictsPage() {
  return (
    <Suspense fallback={<p className={styles.muted}>Loading…</p>}>
      <CadConflictsInner />
    </Suspense>
  );
}
