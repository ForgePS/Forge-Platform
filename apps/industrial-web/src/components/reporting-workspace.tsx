"use client";

import { useEffect, useState } from "react";
import { ApiError, apiGet, apiSend, useAuth } from "@forge/web-kit";

type ReportDefinition = { id: string; report_key: string; name: string; description?: string };

export function ReportingWorkspace({ moduleName }: { moduleName: string }) {
  const { me } = useAuth();
  const [catalog, setCatalog] = useState<ReportDefinition[]>([]);
  const [result, setResult] = useState<{ name: string; rowCount: number } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!(me?.permissions ?? []).includes("reports.view")) return;
    apiGet<ReportDefinition[]>("/api/v1/reports/catalog")
      .then(setCatalog)
      .catch((cause) => setError(cause instanceof ApiError ? cause.message : "Unable to load reports"));
  }, [me]);

  async function run(reportKey: string) {
    try {
      setResult(await apiSend(`/api/v1/reports/${reportKey}/run`, "POST", {}));
      setError("");
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Unable to run report");
    }
  }

  return (
    <section className="ind-ops">
      <header className="ind-ops-header"><h1>{moduleName}</h1><p>Server-side report adapters never accept raw SQL.</p></header>
      {error && <p role="alert" className="ind-error">{error}</p>}
      {result && <p role="status">{result.name}: {result.rowCount} rows</p>}
      <div className="ind-table-wrap">
        <table>
          <thead><tr><th>Report</th><th>Description</th><th>Action</th></tr></thead>
          <tbody>{catalog.map((report) => (
            <tr key={report.id}>
              <td>{report.name}</td><td>{report.description ?? "—"}</td>
              <td><button type="button" onClick={() => void run(report.report_key)}>Run</button></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </section>
  );
}
