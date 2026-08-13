"use client";

import { useEffect, useState, type FormEvent } from "react";
import { apiGet, apiSend, useAuth } from "@forge/web-kit";
import { EmptyState, PageHeader, PageSection } from "@/components/layout/page-chrome";
import { ModuleUnavailable } from "@/components/module-unavailable";
import { COMPLIANCE_MODULE_CONFIG, type Ind6ComplianceModule } from "@/lib/compliance-modules";
import {
  friendlyActionError,
  friendlyLoadError,
  isBackendUnavailableError,
} from "@/lib/friendly-error";

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

export function ComplianceWorkspace({
  module,
  moduleName,
}: {
  module: Ind6ComplianceModule;
  moduleName: string;
}) {
  const cfg = COMPLIANCE_MODULE_CONFIG[module];
  const { me } = useAuth();
  const permissions = new Set(me?.permissions ?? []);
  const canView = permissions.has(cfg.viewPerm) || permissions.has("industrial.admin");
  const canManage = permissions.has(cfg.managePerm) || permissions.has("industrial.admin");
  const canViewSensitive =
    !cfg.sensitivePerm || permissions.has(cfg.sensitivePerm) || permissions.has("industrial.admin");

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
  const [incidentId, setIncidentId] = useState("");
  const [workersCompBackendGap, setWorkersCompBackendGap] = useState(false);

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
          setError(friendlyLoadError(e));
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
    setWorkersCompBackendGap(false);
    try {
      const data = await apiGet<ListResponse>(cfg.listPath, {
        query: {
          q: search || undefined,
          status: st || undefined,
          category: module === "osha" || module === "risk" ? undefined : cat || undefined,
          page: "1",
          pageSize: "25",
        },
      });
      setItems(data.items ?? []);
    } catch (e) {
      setItems([]);
      if (module === "workers-comp" && isBackendUnavailableError(e)) {
        setWorkersCompBackendGap(true);
        setError(null);
      } else {
        setError(friendlyLoadError(e));
      }
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
      if (module === "workers-comp" && isBackendUnavailableError(e)) {
        setWorkersCompBackendGap(true);
        setError(null);
      } else {
        setError(friendlyLoadError(e));
      }
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
          You don&apos;t have access to this module.
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
      if (module === "osha") {
        if (!incidentId.trim()) {
          throw new Error("OSHA cases require an incident ID");
        }
        await apiSend(cfg.createPath, "POST", {
          title: title.trim(),
          incidentId: incidentId.trim(),
          status: "OPEN",
          recordabilityStatus: "PENDING",
          details: {},
        });
      } else if (module === "risk") {
        await apiSend(cfg.createPath, "POST", {
          title: title.trim(),
          status: "OPEN",
          ownerName: workerName.trim() || undefined,
          details: {},
        });
      } else {
        await apiSend(cfg.createPath, "POST", {
          title: title.trim(),
          category: category || cfg.defaultCategory,
          locationText: locationText.trim() || undefined,
          workerName: workerName.trim() || undefined,
          incidentId: cfg.requiresIncident && incidentId.trim() ? incidentId.trim() : undefined,
          status: "DRAFT",
          details: {},
          sensitive: {},
        });
      }
      setTitle("");
      setLocationText("");
      setWorkerName("");
      setIncidentId("");
      await loadList();
    } catch (err) {
      if (module === "workers-comp" && isBackendUnavailableError(err)) {
        setWorkersCompBackendGap(true);
        setError(null);
      } else {
        setError(friendlyActionError(err));
      }
    } finally {
      setCreating(false);
    }
  }

  async function archiveSelected() {
    if (!selectedId || !canManage) return;
    setError(null);
    try {
      await apiSend(`${cfg.listPath}/${selectedId}/archive`, "POST", {});
      await loadList();
      await loadDetail(selectedId);
    } catch (err) {
      if (module === "workers-comp" && isBackendUnavailableError(err)) {
        setWorkersCompBackendGap(true);
        setError(null);
      } else {
        setError(friendlyActionError(err));
      }
    }
  }

  const sensitiveJson = detail?.sensitiveJson as Record<string, unknown> | undefined;
  const sensitiveRedacted = Boolean(sensitiveJson && sensitiveJson.redacted === true);

  return (
    <div className="ind-ops ind-compliance">
      <PageHeader
        title={moduleName}
        description="Compliance and facility safety records for this tenant."
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
            <label className="form-label" htmlFor={`cmp-search-${module}`}>
              Search
            </label>
            <input
              id={`cmp-search-${module}`}
              className="form-control form-control-sm"
              type="search"
              value={q}
              onChange={(ev) => setQ(ev.target.value)}
              autoComplete="off"
            />
          </div>
          {module !== "osha" && module !== "risk" ? (
            <div className="col-md-3">
              <label className="form-label" htmlFor={`cmp-category-${module}`}>
                Category
              </label>
              <input
                id={`cmp-category-${module}`}
                className="form-control form-control-sm"
                type="text"
                value={category}
                onChange={(ev) => setCategory(ev.target.value)}
                autoComplete="off"
              />
            </div>
          ) : null}
          <div className="col-md-3">
            <label className="form-label" htmlFor={`cmp-status-${module}`}>
              Status
            </label>
            <input
              id={`cmp-status-${module}`}
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

      {workersCompBackendGap && module === "workers-comp" ? (
        <div className="card mb-4">
          <EmptyState
            title="Workers' compensation records require a backend that is not enabled for this environment."
            description="Access to claim and medical details is role-gated. Sensitive fields stay restricted to authorized roles even when the API is available."
          />
        </div>
      ) : null}

      {loading ? (
        <p className="text-muted" role="status" aria-live="polite">
          Loading…
        </p>
      ) : workersCompBackendGap && module === "workers-comp" ? null : items.length === 0 ? (
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
                  <th scope="col">Category / Type</th>
                  <th scope="col">Status</th>
                  <th scope="col">Updated</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody className="table-border-bottom-0">
                {items.map((row) => (
                  <tr key={String(row.id)}>
                    <td>{String(row.title ?? "—")}</td>
                    <td>
                      {String(
                        row.category ??
                          row.recordabilityStatus ??
                          row.sourceType ??
                          cfg.defaultCategory,
                      )}
                    </td>
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
          {cfg.sensitivePerm ? (
            <p className="text-muted small" aria-label="Sensitive data access">
              Sensitive fields:{" "}
              {canViewSensitive
                ? sensitiveRedacted
                  ? "redacted by server"
                  : "visible (authorized)"
                : "restricted — requires sensitive permission"}
            </p>
          ) : null}
          <div className="d-flex flex-wrap gap-2">
            {canManage ? (
              <button
                type="button"
                className="btn btn-sm btn-outline-danger"
                onClick={() => void archiveSelected()}
              >
                Archive
              </button>
            ) : null}
          </div>
        </PageSection>
      ) : null}

      {canManage && !(workersCompBackendGap && module === "workers-comp") ? (
        <PageSection title="Create record">
          <form
            className="row g-3"
            onSubmit={onCreate}
            aria-label={`Create ${moduleName}`}
          >
            <div className="col-md-6">
              <label className="form-label" htmlFor={`cmp-create-title-${module}`}>
                Title
              </label>
              <input
                id={`cmp-create-title-${module}`}
                className="form-control form-control-sm"
                required
                value={title}
                onChange={(ev) => setTitle(ev.target.value)}
                autoComplete="off"
              />
            </div>
            {module !== "osha" && module !== "risk" ? (
              <>
                <div className="col-md-6">
                  <label className="form-label" htmlFor={`cmp-create-worker-${module}`}>
                    Worker / contact
                  </label>
                  <input
                    id={`cmp-create-worker-${module}`}
                    className="form-control form-control-sm"
                    value={workerName}
                    onChange={(ev) => setWorkerName(ev.target.value)}
                    autoComplete="off"
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label" htmlFor={`cmp-create-location-${module}`}>
                    Location
                  </label>
                  <input
                    id={`cmp-create-location-${module}`}
                    className="form-control form-control-sm"
                    value={locationText}
                    onChange={(ev) => setLocationText(ev.target.value)}
                    autoComplete="off"
                  />
                </div>
              </>
            ) : null}
            {module === "risk" ? (
              <div className="col-md-6">
                <label className="form-label" htmlFor={`cmp-create-owner-${module}`}>
                  Owner
                </label>
                <input
                  id={`cmp-create-owner-${module}`}
                  className="form-control form-control-sm"
                  value={workerName}
                  onChange={(ev) => setWorkerName(ev.target.value)}
                  autoComplete="off"
                />
              </div>
            ) : null}
            {cfg.requiresIncident || module === "osha" ? (
              <div className="col-md-6">
                <label className="form-label" htmlFor={`cmp-create-incident-${module}`}>
                  Incident ID {module === "osha" ? "(required)" : "(optional)"}
                </label>
                <input
                  id={`cmp-create-incident-${module}`}
                  className="form-control form-control-sm"
                  value={incidentId}
                  onChange={(ev) => setIncidentId(ev.target.value)}
                  autoComplete="off"
                  required={module === "osha"}
                />
              </div>
            ) : null}
            <div className="col-12">
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={creating || !title.trim()}
              >
                {creating ? "Creating…" : "Create"}
              </button>
            </div>
          </form>
        </PageSection>
      ) : null}
    </div>
  );
}
