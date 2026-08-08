"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ApiError, apiGet, apiSend, useAuth } from "@forge/web-kit";
import { ModuleUnavailable } from "@/components/module-unavailable";
import { OPS_MODULE_CONFIG, type Ind3OpsModule } from "@/lib/ops-modules";

type ListResponse = {
  items: Array<Record<string, unknown>>;
  page: number;
  pageSize: number;
};

type BootstrapModule = {
  code: string;
  awsEnabled: boolean;
  available: boolean;
  migrationStatus: string;
};

type Bootstrap = {
  industrialEnabled: boolean;
  modules: BootstrapModule[];
};

export function OpsModuleWorkspace({
  module,
  moduleName,
}: {
  module: Ind3OpsModule;
  moduleName: string;
}) {
  const cfg = OPS_MODULE_CONFIG[module];
  const { me } = useAuth();
  const permissions = new Set(me?.permissions ?? []);
  const canView =
    Boolean(me?.isPlatformAdmin) ||
    permissions.has(cfg.viewPerm) ||
    permissions.has("industrial.admin") ||
    permissions.has("industrial.access");
  const canManage =
    Boolean(me?.isPlatformAdmin) ||
    permissions.has(cfg.managePerm) ||
    permissions.has("industrial.admin");

  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  const modEntry = bootstrap?.modules.find((m) => m.code === cfg.code);
  const awsReady =
    Boolean(bootstrap?.industrialEnabled) && Boolean(modEntry?.awsEnabled) && canView;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const boot = await apiGet<Bootstrap>("/api/v1/industrial/bootstrap");
        if (!cancelled) setBootstrap(boot);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof ApiError ? e.message : "Failed to load module bootstrap");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function loadList(search = q, st = status) {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<ListResponse>(cfg.listPath, {
        query: {
          q: search || undefined,
          status: st || undefined,
          page: "1",
          pageSize: "25",
        },
      });
      setItems(data.items ?? []);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load records");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!awsReady) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const data = await apiGet<ListResponse>(cfg.listPath, {
          query: { page: "1", pageSize: "25" },
        });
        if (!cancelled) setItems(data.items ?? []);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof ApiError ? e.message : "Failed to load records");
          setItems([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [awsReady, module, cfg.listPath]);

  if (!canView) {
    return (
      <div className="card">
        <div className="card-body">
          <h4 className="card-title mb-2">{moduleName}</h4>
          <p className="mb-1">You do not have permission to view this module.</p>
          <p className="text-muted small mb-0">Missing {cfg.viewPerm}</p>
        </div>
      </div>
    );
  }

  if (bootstrap && !awsReady) {
    return (
      <ModuleUnavailable
        moduleName={moduleName}
        status={modEntry?.migrationStatus ?? "MIGRATION_IN_PROGRESS"}
      />
    );
  }

  if (!bootstrap) {
    return (
      <div className="card" role="status" aria-live="polite">
        <div className="card-body">
          <h4 className="card-title mb-2">{moduleName}</h4>
          <p className="text-muted mb-0">Checking module availability…</p>
        </div>
      </div>
    );
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!canManage) return;
    setCreating(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {};
      for (const field of cfg.createFields) {
        const v = form[field.name]?.trim();
        if (v) payload[field.name] = v;
      }
      await apiSend(cfg.createPath, "POST", payload);
      setForm({});
      await loadList();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="ind-ops">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-4">
        <div>
          <h4 className="fw-bold mb-1" id="ops-module-title">
            {moduleName}
          </h4>
          <p className="text-muted mb-0 small">
            AWS candidate module · Production data authority remains Firebase · Flag {cfg.flagKey}
          </p>
        </div>
      </div>

      <div className="card mb-4">
        <div className="card-body">
          <form
            className="row g-3 align-items-end"
            onSubmit={(e) => {
              e.preventDefault();
              void loadList();
            }}
            aria-label={`${moduleName} filters`}
          >
            <div className="col-md-5">
              <label className="form-label" htmlFor={`ops-search-${module}`}>
                Search
              </label>
              <input
                id={`ops-search-${module}`}
                className="form-control"
                type="search"
                value={q}
                onChange={(ev) => setQ(ev.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="col-md-3">
              <label className="form-label" htmlFor={`ops-status-${module}`}>
                Status
              </label>
              <input
                id={`ops-status-${module}`}
                className="form-control"
                type="text"
                value={status}
                onChange={(ev) => setStatus(ev.target.value)}
                placeholder="Optional"
                autoComplete="off"
              />
            </div>
            <div className="col-md-4 d-flex flex-wrap gap-2">
              <button type="submit" className="btn btn-primary">
                Apply filters
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() => {
                  setQ("");
                  setStatus("");
                  void loadList("", "");
                }}
              >
                Clear
              </button>
            </div>
          </form>
        </div>
      </div>

      {error ? (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      ) : null}

      <div className="card mb-4">
        <div className="card-header d-flex justify-content-between align-items-center">
          <h5 className="card-title mb-0">Records</h5>
          {loading ? (
            <span className="text-muted small" role="status" aria-live="polite">
              Loading…
            </span>
          ) : null}
        </div>
        <div className="table-responsive text-nowrap">
          {loading ? null : items.length === 0 ? (
            <div className="card-body">
              <p className="text-muted mb-0">No records yet for this tenant.</p>
            </div>
          ) : (
            <table className="table table-hover mb-0" aria-label={`${moduleName} list`}>
              <thead>
                <tr>
                  <th>Record</th>
                  <th>Status</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody className="table-border-bottom-0">
                {items.map((row) => {
                  const title = String(
                    row[cfg.titleField] ?? row.title ?? row.name ?? row.id ?? "—",
                  );
                  return (
                    <tr key={String(row.id)}>
                      <td className="fw-medium">{title}</td>
                      <td>
                        <span className="badge bg-label-secondary">{String(row.status ?? "—")}</span>
                      </td>
                      <td className="text-muted small">
                        {row.updatedAt ? new Date(String(row.updatedAt)).toLocaleString() : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {canManage ? (
        <div className="card">
          <div className="card-header">
            <h5 className="card-title mb-0">Create</h5>
          </div>
          <div className="card-body">
            <form className="row g-3" onSubmit={(e) => void onCreate(e)} aria-label="Create record">
              {cfg.createFields.map((field) => (
                <div className="col-md-6" key={field.name}>
                  <label className="form-label" htmlFor={`ops-create-${module}-${field.name}`}>
                    {field.label}
                  </label>
                  <input
                    id={`ops-create-${module}-${field.name}`}
                    className="form-control"
                    type={field.type ?? "text"}
                    required={field.required}
                    value={form[field.name] ?? ""}
                    onChange={(ev) =>
                      setForm((prev) => ({ ...prev, [field.name]: ev.target.value }))
                    }
                  />
                </div>
              ))}
              <div className="col-12">
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? "Saving…" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : (
        <p className="text-muted small">Create/edit requires {cfg.managePerm}.</p>
      )}

      {(module === "training" || module === "forms") && (
        <p className="text-muted small mt-3 mb-0" role="note">
          Certification panels and advanced form-builder tooling remain deferred until dependent
          platforms are ready. Historical form submissions preserve definition snapshots.
        </p>
      )}
    </div>
  );
}
