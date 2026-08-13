"use client";

import { useEffect, useState } from "react";
import { ApiError, apiGet, useAuth } from "@forge/web-kit";
import { EmptyState, PageHeader } from "@/components/layout/page-chrome";

type ImportTemplate = { templateKey: string; displayName: string; description: string };

export function IndustrialImportWorkspace({ moduleName }: { moduleName: string }) {
  const { me } = useAuth();
  const [templates, setTemplates] = useState<ImportTemplate[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!(me?.permissions ?? []).includes("import.view")) {
      setLoading(false);
      return;
    }
    setLoading(true);
    apiGet<{ items: ImportTemplate[] }>("/api/v1/imports/templates?productKey=FORGE_INDUSTRIAL")
      .then((data) => {
        setTemplates(data.items);
        setError("");
      })
      .catch((cause) => {
        setTemplates([]);
        setError(cause instanceof ApiError ? cause.message : "Unable to load import templates");
      })
      .finally(() => setLoading(false));
  }, [me]);

  return (
    <div className="ind-ops">
      <PageHeader
        title={moduleName}
        description="Uses the Universal Import API for jobs, mappings, validation, and execution."
      />

      {error ? (
        <div className="alert alert-warning" role="alert">
          {error}
        </div>
      ) : null}

      <div className="card">
        <div className="card-header">
          <h5 className="card-title mb-0">Import templates</h5>
        </div>
        {loading ? (
          <div className="card-body text-muted">Loading…</div>
        ) : templates.length === 0 ? (
          <EmptyState
            title="No import templates yet"
            description="Import templates for Forge Industrial will appear here when configured."
          />
        ) : (
          <div className="table-responsive text-nowrap">
            <table className="table table-sm mb-0">
              <thead>
                <tr>
                  <th>Template</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody className="table-border-bottom-0">
                {templates.map((template) => (
                  <tr key={template.templateKey}>
                    <td className="fw-medium">{template.displayName}</td>
                    <td>{template.description}</td>
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
