"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ApiError, apiGet, apiSend, useAuth } from "@forge/web-kit";
import { EmptyState, PageHeader, PageSection } from "@/components/layout/page-chrome";

type DocumentItem = { id: string; name: string; category?: string | null; status: string };

export function DocumentsWorkspace({ moduleName }: { moduleName: string }) {
  const { me } = useAuth();
  const permissions = new Set(me?.permissions ?? []);
  const [items, setItems] = useState<DocumentItem[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      setItems(await apiGet<DocumentItem[]>("/api/v1/documents"));
      setError("");
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Unable to load documents");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (permissions.has("documents.view") || me?.isPlatformAdmin) void load();
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.tenantId]);

  async function create(event: FormEvent) {
    event.preventDefault();
    try {
      await apiSend("/api/v1/documents", "POST", { name, category: "INDUSTRIAL" });
      setName("");
      await load();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Unable to create document");
    }
  }

  return (
    <div className="ind-ops">
      <PageHeader
        title={moduleName}
        description="Tenant-scoped documents with immutable versions and delivery controls."
      />

      {error ? (
        <div className="alert alert-warning" role="alert">
          {error}
        </div>
      ) : null}

      {permissions.has("documents.upload") || me?.isPlatformAdmin ? (
        <PageSection title="Create document">
          <form className="row g-3 align-items-end" onSubmit={(event) => void create(event)}>
            <div className="col-md-8">
              <label className="form-label" htmlFor="doc-name">
                Document name
              </label>
              <input
                id="doc-name"
                className="form-control form-control-sm"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="col-md-4">
              <button type="submit" className="btn btn-primary btn-sm">
                Create
              </button>
            </div>
          </form>
        </PageSection>
      ) : null}

      <div className="card">
        <div className="card-header">
          <h5 className="card-title mb-0">Documents</h5>
        </div>
        {loading ? (
          <div className="card-body text-muted">Loading…</div>
        ) : items.length === 0 ? (
          <EmptyState
            title="No documents yet"
            description="Created documents for this tenant will appear here."
          />
        ) : (
          <div className="table-responsive text-nowrap">
            <table className="table table-sm mb-0">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody className="table-border-bottom-0">
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="fw-medium">{item.name}</td>
                    <td>{item.category ?? "—"}</td>
                    <td>
                      <span className="badge bg-label-secondary">{item.status}</span>
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
