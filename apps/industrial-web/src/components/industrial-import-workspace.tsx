"use client";

import { useEffect, useState } from "react";
import { ApiError, apiGet, useAuth } from "@forge/web-kit";

type ImportTemplate = { templateKey: string; displayName: string; description: string };

export function IndustrialImportWorkspace({ moduleName }: { moduleName: string }) {
  const { me } = useAuth();
  const [templates, setTemplates] = useState<ImportTemplate[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!(me?.permissions ?? []).includes("import.view")) return;
    apiGet<{ items: ImportTemplate[] }>("/api/v1/imports/templates?productKey=FORGE_INDUSTRIAL")
      .then((data) => setTemplates(data.items))
      .catch((cause) =>
        setError(cause instanceof ApiError ? cause.message : "Unable to load import templates"),
      );
  }, [me]);

  return (
    <section className="ind-ops">
      <header className="ind-ops-header">
        <h1>{moduleName}</h1>
        <p>
          This workspace uses the Universal Import API and its existing jobs, mappings, validation,
          and execution pipeline.
        </p>
      </header>
      {error && (
        <p role="alert" className="ind-error">
          {error}
        </p>
      )}
      <div className="ind-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Template</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {templates.map((template) => (
              <tr key={template.templateKey}>
                <td>{template.displayName}</td>
                <td>{template.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
