"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useFeatureFlags } from "@forge/web-kit";
import { RMS_FEATURE_FLAGS } from "@/lib/constants";
import { getIncidentCadStatus, type CadIncidentStatus } from "@/lib/rms-api";
import styles from "../app/page.module.css";

export function IncidentCadPanel({
  tenantId,
  incidentId,
}: {
  tenantId: string;
  incidentId: string;
}) {
  const { flags, loading: flagsLoading } = useFeatureFlags([RMS_FEATURE_FLAGS.cadEnabled]);
  const [status, setStatus] = useState<CadIncidentStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!flags[RMS_FEATURE_FLAGS.cadEnabled]) return;
    setError(null);
    try {
      setStatus(await getIncidentCadStatus(tenantId, incidentId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load CAD status");
    }
  }, [flags, incidentId, tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (flagsLoading || !flags[RMS_FEATURE_FLAGS.cadEnabled]) return null;

  const activeLinks = status?.links.filter((link) => link.linkStatus === "ACTIVE") ?? [];
  const conflicts = status?.openConflicts ?? [];

  return (
    <div className={styles.panel} aria-label="CAD status">
      <h2>CAD status</h2>
      {error ? <p className={styles.error}>{error}</p> : null}
      {!status && !error ? <p className={styles.muted}>Loading CAD status…</p> : null}
      {status ? (
        <>
          <p className={styles.muted} style={{ marginTop: 0 }}>
            {activeLinks.length > 0
              ? `Linked to ${activeLinks.length} CAD source${activeLinks.length === 1 ? "" : "s"}.`
              : "Not linked to CAD."}
            {conflicts.length > 0 ? ` ${conflicts.length} open conflict(s).` : ""}
          </p>
          {activeLinks.length > 0 ? (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Source incident</th>
                  <th>Number</th>
                  <th>Method</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {activeLinks.map((link) => (
                  <tr key={link.id}>
                    <td className={styles.mono}>{link.sourceIncidentId}</td>
                    <td>{link.sourceIncidentNumber ?? "—"}</td>
                    <td>{link.linkMethod}</td>
                    <td>{link.linkStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
          {conflicts.length > 0 ? (
            <p style={{ marginBottom: 0 }}>
              <Link href="/cad/conflicts/">Review CAD conflicts</Link>
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
