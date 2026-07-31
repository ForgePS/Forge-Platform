"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useAuth } from "@forge/web-kit";
import { FeatureGate } from "@/components/feature-gate";
import { listCadMessages, type CadRawMessageMeta } from "@/lib/rms-api";
import { FxTable } from "@/fx/tables/FxTable";
import { FxTableEmpty } from "@/fx/tables/FxTableStates";
import { TableSectionBoundary } from "@/fx/tables/TableSectionBoundary";
import { ensureTablesRegistered } from "@/fx/tables/register-all";
import { useRmsFxCadMessagesModule } from "@/fx/modules/use-cad-messages-module";
import styles from "../../page.module.css";

function CadMessagesInner() {
  const { me } = useAuth();
  const { list: listMode, loading: moduleFlagLoading } = useRmsFxCadMessagesModule();
  const [items, setItems] = useState<CadRawMessageMeta[]>([]);
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
      setItems(await listCadMessages(me.tenantId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load CAD messages");
    } finally {
      setLoading(false);
    }
  }, [me?.tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const useFx = !moduleFlagLoading && listMode === "fx";

  return (
    <FeatureGate flag="cadOperations" title="CAD Messages">
      <section
        className={styles.page}
        data-testid={useFx ? "rms-fx-cad-messages" : "rms-legacy-cad-messages"}
      >
        <h1>CAD message metadata</h1>
        <p className={styles.lead}>
          Metadata only — raw payloads and secrets are excluded from this view.
        </p>
        {error ? <p className={styles.error}>{error}</p> : null}
        {useFx ? (
          <TableSectionBoundary title="CAD messages">
            <FxTable
              caption="CAD messages"
              loading={loading}
              empty={
                <FxTableEmpty
                  title="No CAD messages yet."
                  description="Messages appear after CAD intake."
                />
              }
              rows={items}
              rowKey={(row) => row.id}
              columns={[
                {
                  id: "received",
                  header: "Received",
                  accessor: (row) => new Date(row.receivedAt).toLocaleString(),
                },
                { id: "status", header: "Status", accessor: (row) => row.processingStatus },
                { id: "auth", header: "Auth", accessor: (row) => row.authenticationStatus },
                {
                  id: "sourceMessage",
                  header: "Source message",
                  accessor: (row) => (
                    <span className={styles.mono}>{row.sourceMessageId ?? "—"}</span>
                  ),
                },
                {
                  id: "sourceIncident",
                  header: "Source incident",
                  accessor: (row) => (
                    <span className={styles.mono}>{row.sourceIncidentId ?? "—"}</span>
                  ),
                },
                {
                  id: "size",
                  header: "Size",
                  accessor: (row) => (
                    <span className={styles.mono}>{row.payloadSizeBytes ?? "—"}</span>
                  ),
                },
              ]}
            />
          </TableSectionBoundary>
        ) : (
          <div className={styles.panel}>
            {loading ? <p className={styles.muted}>Loading…</p> : null}
            {!loading && items.length === 0 ? (
              <p className={styles.muted}>No CAD messages yet.</p>
            ) : null}
            {items.length > 0 ? (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Received</th>
                    <th>Status</th>
                    <th>Auth</th>
                    <th>Source message</th>
                    <th>Source incident</th>
                    <th>Size</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr key={row.id}>
                      <td>{new Date(row.receivedAt).toLocaleString()}</td>
                      <td>{row.processingStatus}</td>
                      <td>{row.authenticationStatus}</td>
                      <td className={styles.mono}>{row.sourceMessageId ?? "—"}</td>
                      <td className={styles.mono}>{row.sourceIncidentId ?? "—"}</td>
                      <td className={styles.mono}>{row.payloadSizeBytes ?? "—"}</td>
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

export default function CadMessagesPage() {
  return (
    <Suspense fallback={<p className={styles.muted}>Loading…</p>}>
      <CadMessagesInner />
    </Suspense>
  );
}
