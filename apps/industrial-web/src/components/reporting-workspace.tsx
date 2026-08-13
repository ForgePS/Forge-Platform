"use client";

import { useEffect, useState } from "react";
import { ApiError, apiGet, apiSend, useAuth } from "@forge/web-kit";
import { EmptyState, PageHeader } from "@/components/layout/page-chrome";

type ReportDefinition = { id: string; report_key: string; name: string; description?: string };

export function ReportingWorkspace({ moduleName }: { moduleName: string }) {
  const { me } = useAuth();
  const [catalog, setCatalog] = useState<ReportDefinition[]>([]);
  const [result, setResult] = useState<{ name: string; rowCount: number } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const canView =
      Boolean(me?.isPlatformAdmin) || (me?.permissions ?? []).includes("reports.view");
    if (!canView) {
      setLoading(false);
      return;
    }
    setLoading(true);
    apiGet<ReportDefinition[]>("/api/v1/reports/catalog")
      .then((rows) => {
        setCatalog(rows);
        setError("");
      })
      .catch((cause) => {
        setCatalog([]);
        setError(cause instanceof ApiError ? cause.message : "Unable to load reports");
      })
      .finally(() => setLoading(false));
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
    <div className="ind-ops">
      <PageHeader
        title={moduleName}
        description="Server-side report adapters (no raw SQL)."
      />

      {error ? (
        <div className="alert alert-warning" role="alert">
          {error}
        </div>
      ) : null}

      {result ? (
        <div className="alert alert-success" role="status">
          {result.name}: {result.rowCount} rows
        </div>
      ) : null}

      <div className="card">
        <div className="card-header">
          <h5 className="card-title mb-0">Report catalog</h5>
        </div>
        {loading ? (
          <div className="card-body text-muted">Loading…</div>
        ) : catalog.length === 0 ? (
          <EmptyState
            title="No report definitions available"
            description="Report definitions for this tenant will appear here when configured."
          />
        ) : (
          <div className="table-responsive text-nowrap">
            <table className="table table-sm mb-0">
              <thead>
                <tr>
                  <th>Report</th>
                  <th>Description</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody className="table-border-bottom-0">
                {catalog.map((report) => (
                  <tr key={report.id}>
                    <td className="fw-medium">{report.name}</td>
                    <td>{report.description ?? "—"}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary"
                        onClick={() => void run(report.report_key)}
                      >
                        Run
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
