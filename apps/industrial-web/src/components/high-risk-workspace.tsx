"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ApiError, apiGet, apiSend, useAuth } from "@forge/web-kit";
import { EmptyState, PageHeader, PageSection } from "@/components/layout/page-chrome";
import { ModuleUnavailable } from "@/components/module-unavailable";
import { HIGH_RISK_MODULE_CONFIG, type Ind5HighRiskModule } from "@/lib/high-risk-modules";

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

export function HighRiskWorkspace({
  module,
  moduleName,
}: {
  module: Ind5HighRiskModule;
  moduleName: string;
}) {
  const cfg = HIGH_RISK_MODULE_CONFIG[module];
  const { me } = useAuth();
  const permissions = new Set(me?.permissions ?? []);
  const canView = permissions.has(cfg.viewPerm) || permissions.has("industrial.admin");
  const canManage = permissions.has(cfg.managePerm) || permissions.has("industrial.admin");
  const canApprove = permissions.has(cfg.approvePerm) || permissions.has("industrial.admin");

  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState(cfg.defaultCategory);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [locationText, setLocationText] = useState("");
  const [workerName, setWorkerName] = useState("");

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

  async function loadList(search = q, st = status, cat = category) {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<ListResponse>(cfg.listPath, {
        query: {
          q: search || undefined,
          status: st || undefined,
          category: cat || undefined,
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

  async function loadDetail(id: string) {
    setError(null);
    try {
      const row = await apiGet<Record<string, unknown>>(`${cfg.listPath}/${id}`);
      setDetail(row);
      setSelectedId(id);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load record");
      setDetail(null);
    }
  }

  useEffect(() => {
    if (!awsReady) {
      setLoading(false);
      return;
    }
    void loadList("", "", cfg.defaultCategory);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load when gate opens
  }, [awsReady, module, cfg.listPath, cfg.defaultCategory]);

  if (!canView) {
    return (
      <div className="ind-ops">
        <PageHeader title={moduleName} />
        <div className="alert alert-warning mb-0" role="alert">
          You do not have permission to view this module.
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
      <div className="ind-ops">
        <PageHeader title={moduleName} />
        <p className="text-muted mb-0" role="status" aria-live="polite">
          Checking module availability…
        </p>
      </div>
    );
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!canManage) return;
    setCreating(true);
    setError(null);
    try {
      await apiSend(cfg.createPath, "POST", {
        title: title.trim(),
        category: category || cfg.defaultCategory,
        locationText: locationText.trim() || undefined,
        workerName: workerName.trim() || undefined,
        status: "DRAFT",
        details: {},
      });
      setTitle("");
      setLocationText("");
      setWorkerName("");
      await loadList();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }

  async function transition(action: "submit" | "approve" | "close" | "archive") {
    if (!selectedId) return;
    const allowed =
      action === "approve" ? canApprove : action === "close" ? canManage || canApprove : canManage;
    if (!allowed) return;
    setError(null);
    try {
      await apiSend(`${cfg.listPath}/${selectedId}/${action}`, "POST", {});
      await loadList();
      await loadDetail(selectedId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `${action} failed`);
    }
  }

  return (
    <div className="ind-ops ind-high-risk">
      <PageHeader
        title={moduleName}
        description="High-risk work permits and records for this tenant."
      />

      <PageSection title="Filters" bodyClassName="pt-3">
        <form
          className="row g-3 align-items-end"
          onSubmit={(e) => {
            e.preventDefault();
            void loadList();
          }}
          aria-label={`${moduleName} filters`}
        >
          <div className="col-md-4">
            <label className="form-label" htmlFor={`hr-search-${module}`}>
              Search
            </label>
            <input
              id={`hr-search-${module}`}
              className="form-control form-control-sm"
              type="search"
              value={q}
              onChange={(ev) => setQ(ev.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="col-md-3">
            <label className="form-label" htmlFor={`hr-category-${module}`}>
              Category
            </label>
            <input
              id={`hr-category-${module}`}
              className="form-control form-control-sm"
              type="text"
              value={category}
              onChange={(ev) => setCategory(ev.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="col-md-3">
            <label className="form-label" htmlFor={`hr-status-${module}`}>
              Status
            </label>
            <input
              id={`hr-status-${module}`}
              className="form-control form-control-sm"
              type="text"
              value={status}
              onChange={(ev) => setStatus(ev.target.value)}
              placeholder="Optional"
              autoComplete="off"
            />
          </div>
          <div className="col-md-2">
            <button type="submit" className="btn btn-primary btn-sm">
              Apply filters
            </button>
          </div>
        </form>
      </PageSection>

      {error ? (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      ) : null}

      {loading ? (
        <p className="text-muted" role="status" aria-live="polite">
          Loading…
        </p>
      ) : items.length === 0 ? (
        <div className="card mb-4">
          <EmptyState
            title="No records yet"
            description="When records are created for this module, they will appear here."
          />
        </div>
      ) : (
        <div className="card mb-4">
          <div className="table-responsive text-nowrap">
            <table className="table table-hover table-sm mb-0" aria-label={`${moduleName} list`}>
              <thead>
                <tr>
                  <th scope="col">Title</th>
                  <th scope="col">Category</th>
                  <th scope="col">Status</th>
                  <th scope="col">Updated</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody className="table-border-bottom-0">
                {items.map((row) => (
                  <tr key={String(row.id)}>
                    <td>{String(row.title ?? "—")}</td>
                    <td>{String(row.category ?? "—")}</td>
                    <td>
                      <span className="badge bg-label-secondary">{String(row.status ?? "—")}</span>
                    </td>
                    <td>{row.updatedAt ? new Date(String(row.updatedAt)).toLocaleString() : "—"}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary"
                        onClick={() => void loadDetail(String(row.id))}
                      >
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {detail ? (
        <PageSection title={String(detail.title ?? "Record")}>
          <p className="mb-2">
            Status: <strong>{String(detail.status ?? "—")}</strong>
          </p>
          <p className="text-muted small">Location: {String(detail.locationText ?? "—")}</p>
          <div className="d-flex flex-wrap gap-2 mb-3">
            {canManage ? (
              <button
                type="button"
                className="btn btn-sm btn-outline-primary"
                onClick={() => void transition("submit")}
              >
                Submit
              </button>
            ) : null}
            {canApprove ? (
              <button
                type="button"
                className="btn btn-sm btn-outline-primary"
                onClick={() => void transition("approve")}
              >
                Approve / Open
              </button>
            ) : null}
            {canManage || canApprove ? (
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => void transition("close")}
              >
                Close
              </button>
            ) : null}
            {canManage ? (
              <button
                type="button"
                className="btn btn-sm btn-outline-danger"
                onClick={() => void transition("archive")}
              >
                Archive
              </button>
            ) : null}
          </div>
          {Array.isArray(detail.assignments) && (detail.assignments as unknown[]).length > 0 ? (
            <p className="text-muted small mb-0">
              Assignments:{" "}
              {(detail.assignments as Array<{ roleKey?: string }>).map((a) => a.roleKey).join(", ")}
            </p>
          ) : null}
          {Array.isArray(detail.readings) && (detail.readings as unknown[]).length > 0 ? (
            <p className="text-muted small mb-0">
              Atmospheric readings: {(detail.readings as unknown[]).length}
            </p>
          ) : null}
        </PageSection>
      ) : null}

      {canManage ? (
        <PageSection title="Create">
          <form
            className="row g-3"
            onSubmit={(e) => void onCreate(e)}
            aria-label="Create record"
          >
            <div className="col-md-6">
              <label className="form-label" htmlFor={`hr-create-title-${module}`}>
                Title
              </label>
              <input
                id={`hr-create-title-${module}`}
                className="form-control form-control-sm"
                required
                value={title}
                onChange={(ev) => setTitle(ev.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="col-md-6">
              <label className="form-label" htmlFor={`hr-create-category-${module}`}>
                Category
              </label>
              <input
                id={`hr-create-category-${module}`}
                className="form-control form-control-sm"
                required
                value={category}
                onChange={(ev) => setCategory(ev.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="col-md-6">
              <label className="form-label" htmlFor={`hr-create-location-${module}`}>
                Location
              </label>
              <input
                id={`hr-create-location-${module}`}
                className="form-control form-control-sm"
                value={locationText}
                onChange={(ev) => setLocationText(ev.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="col-md-6">
              <label className="form-label" htmlFor={`hr-create-worker-${module}`}>
                Worker / primary person
              </label>
              <input
                id={`hr-create-worker-${module}`}
                className="form-control form-control-sm"
                value={workerName}
                onChange={(ev) => setWorkerName(ev.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="col-12">
              <button type="submit" className="btn btn-primary btn-sm" disabled={creating}>
                {creating ? "Saving…" : "Create draft"}
              </button>
            </div>
          </form>
        </PageSection>
      ) : (
        <p className="text-muted small">Create and edit require additional permissions.</p>
      )}
    </div>
  );
}
