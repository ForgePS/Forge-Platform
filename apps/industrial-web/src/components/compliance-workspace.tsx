"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { apiGet, apiSend, useAuth } from "@forge/web-kit";
import { EmptyState, PageHeader, PageSection } from "@/components/layout/page-chrome";
import { ModuleUnavailable } from "@/components/module-unavailable";
import { FilterPanel } from "@/components/filter-panel";
import { StatusBadge } from "@/components/status-badge";
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

type WcDetailTab = "overview" | "claim" | "notes";

const WC_STATUSES = [
  { value: "DRAFT", label: "Draft" },
  { value: "OPEN", label: "Open" },
  { value: "PENDING", label: "Pending" },
  { value: "CLOSED", label: "Closed" },
  { value: "ARCHIVED", label: "Archived" },
];

/**
 * IND-6 compliance workspaces (OSHA, Risk, Workers' Comp, etc.).
 * Workers' Comp gets case-oriented polish while preserving sensitive permission gates.
 */
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

  const isWc = module === "workers-comp";

  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [wcTab, setWcTab] = useState<WcDetailTab>("overview");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState(cfg.defaultCategory);
  const [caseNotes, setCaseNotes] = useState("");
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

  const kpis = useMemo(() => {
    if (!isWc) return null;
    const open = items.filter((i) =>
      ["OPEN", "PENDING", "DRAFT"].includes(String(i.status ?? "").toUpperCase()),
    ).length;
    const closed = items.filter((i) =>
      ["CLOSED", "ARCHIVED"].includes(String(i.status ?? "").toUpperCase()),
    ).length;
    return { total: items.length, open, closed };
  }, [items, isWc]);

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
      if (isWc && isBackendUnavailableError(e)) {
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
    setWcTab("overview");
    try {
      const row = await apiGet<Record<string, unknown>>(`${cfg.listPath}/${id}`);
      setDetail(row);
      setSelectedId(id);
      const details = (row.detailsJson ?? row.details ?? {}) as Record<string, unknown>;
      setCaseNotes(String(details.caseNotes ?? details.notes ?? ""));
    } catch (e) {
      if (isWc && isBackendUnavailableError(e)) {
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
      if (isWc && isBackendUnavailableError(err)) {
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
      if (isWc && isBackendUnavailableError(err)) {
        setWorkersCompBackendGap(true);
        setError(null);
      } else {
        setError(friendlyActionError(err));
      }
    }
  }

  const sensitiveJson = detail?.sensitiveJson as Record<string, unknown> | undefined;
  const sensitiveRedacted = Boolean(sensitiveJson && sensitiveJson.redacted === true);
  const detailBlob = (detail?.detailsJson ?? detail?.details ?? {}) as Record<string, unknown>;

  const chips = [
    ...(q ? [{ id: "q", label: `Search: ${q}`, onRemove: () => setQ("") }] : []),
    ...(status
      ? [{ id: "status", label: `Status: ${status}`, onRemove: () => setStatus("") }]
      : []),
    ...(module !== "osha" && module !== "risk" && category
      ? [
          {
            id: "category",
            label: `Category: ${category}`,
            onRemove: () => setCategory(cfg.defaultCategory),
          },
        ]
      : []),
  ];

  return (
    <div className="ind-ops ind-compliance">
      <PageHeader
        title={moduleName}
        description={
          isWc
            ? "Track claim cases by employee — medical and claim details stay role-gated."
            : "Compliance and facility safety records for this company."
        }
      />

      {isWc && kpis && !workersCompBackendGap ? (
        <div className="row g-3 mb-4">
          {(
            [
              ["Cases", kpis.total],
              ["Open / in progress", kpis.open],
              ["Closed", kpis.closed],
            ] as const
          ).map(([label, count]) => (
            <div className="col-4" key={label}>
              <div className="card mb-0">
                <div className="card-body py-3">
                  <div className="text-muted text-uppercase small">{label}</div>
                  <div className="fw-semibold fs-4">{loading ? "—" : count}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <FilterPanel
        searchId={`cmp-search-${module}`}
        searchValue={q}
        onSearchChange={setQ}
        searchPlaceholder={isWc ? "Employee or case title…" : "Search records…"}
        statusId={`cmp-status-${module}`}
        statusValue={status}
        onStatusChange={setStatus}
        {...(isWc ? { statusOptions: WC_STATUSES.map((s) => ({ ...s })) } : {})}
        chips={chips}
        onClearAll={() => {
          setQ("");
          setStatus("");
          setCategory(cfg.defaultCategory);
          void loadList("", "", cfg.defaultCategory);
        }}
        onSubmit={() => void loadList()}
        extraFields={
          module !== "osha" && module !== "risk" ? (
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
          ) : undefined
        }
      />

      {error ? (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      ) : null}

      {workersCompBackendGap && isWc ? (
        <div className="card mb-4">
          <EmptyState
            title="Workers' compensation records aren't available in this environment yet"
            description="Claim and medical details are role-gated. When the API is enabled, only authorized roles can see sensitive fields."
          />
        </div>
      ) : null}

      {loading ? (
        <p className="text-muted" role="status" aria-live="polite">
          Loading…
        </p>
      ) : workersCompBackendGap && isWc ? null : items.length === 0 ? (
        <div className="card mb-4">
          <EmptyState
            title={isWc ? "No claim cases yet" : "No records yet"}
            description={
              isWc
                ? "Create a case for an injured employee to start tracking claim status."
                : "When records are created for this module, they will appear here."
            }
          />
        </div>
      ) : (
        <div className="card mb-4">
          <div className="table-responsive text-nowrap">
            <table className="table table-hover table-sm mb-0" aria-label={`${moduleName} list`}>
              <thead>
                <tr>
                  {isWc ? <th scope="col">Employee</th> : null}
                  <th scope="col">{isWc ? "Case" : "Title"}</th>
                  <th scope="col">{isWc ? "Type" : "Category / Type"}</th>
                  <th scope="col">Status</th>
                  <th scope="col">Updated</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody className="table-border-bottom-0">
                {items.map((row) => (
                  <tr
                    key={String(row.id)}
                    className={selectedId === String(row.id) ? "table-active" : undefined}
                  >
                    {isWc ? (
                      <td className="fw-medium">{String(row.workerName ?? "—")}</td>
                    ) : null}
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
                      <StatusBadge status={String(row.status ?? "")} />
                    </td>
                    <td>
                      {row.updatedAt ? new Date(String(row.updatedAt)).toLocaleString() : "—"}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary"
                        onClick={() => void loadDetail(String(row.id))}
                      >
                        {isWc ? "Open case" : "Open"}
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
        <PageSection
          title={
            isWc
              ? String(detail.workerName || detail.title || "Claim case")
              : String(detail.title ?? "Record")
          }
          actions={
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={() => {
                setDetail(null);
                setSelectedId(null);
              }}
            >
              Close
            </button>
          }
        >
          {isWc ? (
            <div className="btn-group mb-3" role="tablist" aria-label="Case sections">
              {(
                [
                  ["overview", "Overview"],
                  ["claim", "Claim"],
                  ["notes", "Notes"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={wcTab === id}
                  className={`btn btn-sm ${wcTab === id ? "btn-primary" : "btn-outline-secondary"}`}
                  onClick={() => setWcTab(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}

          {!isWc || wcTab === "overview" ? (
            <dl className="row small mb-3">
              {isWc ? (
                <>
                  <dt className="col-sm-3 text-muted">Employee</dt>
                  <dd className="col-sm-9">{String(detail.workerName ?? "—")}</dd>
                  <dt className="col-sm-3 text-muted">Case title</dt>
                  <dd className="col-sm-9">{String(detail.title ?? "—")}</dd>
                </>
              ) : (
                <>
                  <dt className="col-sm-3 text-muted">Title</dt>
                  <dd className="col-sm-9">{String(detail.title ?? "—")}</dd>
                </>
              )}
              <dt className="col-sm-3 text-muted">Status</dt>
              <dd className="col-sm-9">
                <StatusBadge status={String(detail.status ?? "")} />
              </dd>
              <dt className="col-sm-3 text-muted">Location</dt>
              <dd className="col-sm-9">{String(detail.locationText ?? "—")}</dd>
              {detail.incidentId ? (
                <>
                  <dt className="col-sm-3 text-muted">Related incident</dt>
                  <dd className="col-sm-9">
                    <span className="font-monospace small">{String(detail.incidentId)}</span>
                  </dd>
                </>
              ) : null}
            </dl>
          ) : null}

          {isWc && wcTab === "claim" ? (
            <div className="mb-3">
              <p className="small text-muted mb-2">
                Claim reference and medical details are restricted. Unauthorized roles never see
                raw sensitive payloads.
              </p>
              <dl className="row small mb-0">
                <dt className="col-sm-3 text-muted">Category</dt>
                <dd className="col-sm-9">{String(detail.category ?? cfg.defaultCategory)}</dd>
                <dt className="col-sm-3 text-muted">Sensitive access</dt>
                <dd className="col-sm-9">
                  {!canViewSensitive
                    ? "Restricted — requires workers' comp sensitive permission"
                    : sensitiveRedacted
                      ? "Redacted by server for this role"
                      : "Authorized — claim fields visible when present"}
                </dd>
                {canViewSensitive && !sensitiveRedacted && sensitiveJson ? (
                  <>
                    <dt className="col-sm-3 text-muted">Claim fields</dt>
                    <dd className="col-sm-9">
                      <pre className="small mb-0 p-2 bg-light rounded border">
                        {JSON.stringify(sensitiveJson, null, 2)}
                      </pre>
                    </dd>
                  </>
                ) : null}
              </dl>
            </div>
          ) : null}

          {isWc && wcTab === "notes" ? (
            <div className="mb-3">
              <label className="form-label" htmlFor="wc-case-notes">
                Case notes
              </label>
              <textarea
                id="wc-case-notes"
                className="form-control form-control-sm"
                rows={4}
                readOnly
                value={
                  caseNotes ||
                  String(detailBlob.caseNotes ?? detailBlob.notes ?? "No notes recorded yet.")
                }
              />
              <p className="text-muted small mt-2 mb-0">
                Editable case notes land with the next fields API pass for compliance cases.
              </p>
            </div>
          ) : null}

          {!isWc && cfg.sensitivePerm ? (
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

      {canManage && !(workersCompBackendGap && isWc) ? (
        <PageSection title={isWc ? "New claim case" : "Create record"}>
          <form className="row g-3" onSubmit={onCreate} aria-label={`Create ${moduleName}`}>
            <div className="col-md-6">
              <label className="form-label" htmlFor={`cmp-create-title-${module}`}>
                {isWc ? "Case title" : "Title"}
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
                    {isWc ? "Employee name" : "Worker / contact"}
                  </label>
                  <input
                    id={`cmp-create-worker-${module}`}
                    className="form-control form-control-sm"
                    value={workerName}
                    onChange={(ev) => setWorkerName(ev.target.value)}
                    autoComplete="off"
                    required={isWc}
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
                  {isWc ? "Related incident (optional)" : `Incident ID ${module === "osha" ? "(required)" : "(optional)"}`}
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
                disabled={creating || !title.trim() || (isWc && !workerName.trim())}
              >
                {creating ? "Creating…" : isWc ? "Create case" : "Create"}
              </button>
            </div>
          </form>
        </PageSection>
      ) : null}
    </div>
  );
}
