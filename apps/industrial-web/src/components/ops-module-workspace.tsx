"use client";

import { Fragment, useEffect, useMemo, useState, type FormEvent } from "react";
import { apiGet, apiSend, useAuth } from "@forge/web-kit";
import { EmptyState, PageHeader, PageSection } from "@/components/layout/page-chrome";
import { ModuleUnavailable } from "@/components/module-unavailable";
import { friendlyActionError, friendlyLoadError } from "@/lib/friendly-error";
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

const DETAIL_SKIP = new Set([
  "id",
  "module",
  "recordVersion",
  "createdAt",
  "updatedAt",
  "displayName",
]);

const WIZARD_MODULES = new Set<Ind3OpsModule>(["incidents", "inspections"]);
const WIZARD_STEPS = [
  { step: 1, label: "Basics" },
  { step: 2, label: "Details" },
  { step: 3, label: "Review" },
] as const;

type TrainingChip = "all" | "Upcoming" | "Overdue" | "Complete";

function trainingChipForItem(row: Record<string, unknown>): TrainingChip | null {
  const raw = String(row.completionStatus ?? row.status ?? "")
    .trim()
    .toLowerCase();
  if (raw === "upcoming" || raw === "scheduled" || raw === "assigned") return "Upcoming";
  if (raw === "overdue" || raw === "past_due" || raw === "past due") return "Overdue";
  if (raw === "complete" || raw === "completed" || raw === "done") return "Complete";

  const due = row.dueDate ? new Date(String(row.dueDate)) : null;
  if (due && !Number.isNaN(due.getTime())) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDay = new Date(due);
    dueDay.setHours(0, 0, 0, 0);
    if (dueDay < today) return "Overdue";
    return "Upcoming";
  }
  return null;
}

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

  const useWizard = WIZARD_MODULES.has(module);
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [statusDraft, setStatusDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [wizardStep, setWizardStep] = useState(1);
  const [trainingChip, setTrainingChip] = useState<TrainingChip>("all");

  const modEntry = bootstrap?.modules.find((m) => m.code === cfg.code);
  const awsReady =
    Boolean(bootstrap?.industrialEnabled) && Boolean(modEntry?.awsEnabled) && canView;

  const displayedItems = useMemo(() => {
    if (module !== "training" || trainingChip === "all") return items;
    return items.filter((row) => trainingChipForItem(row) === trainingChip);
  }, [items, module, trainingChip]);

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
      setError(friendlyLoadError(e));
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
          setError(friendlyLoadError(e));
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

  async function openDetail(row: Record<string, unknown>) {
    setSelected(row);
    setStatusDraft(String(row.status ?? "ACTIVE"));
    try {
      const data = await apiGet<Record<string, unknown>>(`${cfg.listPath}/${String(row.id)}`);
      setSelected(data);
      setStatusDraft(String(data.status ?? "ACTIVE"));
    } catch {
      // List payload is enough when get-by-id is unavailable.
    }
  }

  async function saveStatus() {
    if (!canManage || !selected?.id) return;
    setError(null);
    try {
      const updated = await apiSend<Record<string, unknown>>(
        `${cfg.listPath}/${String(selected.id)}/status`,
        "POST",
        { status: statusDraft },
      );
      setSelected(updated);
      await loadList();
    } catch (e) {
      setError(friendlyActionError(e));
    }
  }

  if (!canView) {
    return (
      <div className="card">
        <div className="card-body">
          <h4 className="card-title mb-2">{moduleName}</h4>
          <p className="mb-1">You don&apos;t have access to this module.</p>
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
        flagOff={!modEntry?.awsEnabled}
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

  async function submitCreate() {
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
      setWizardStep(1);
      await loadList();
    } catch (err) {
      setError(friendlyActionError(err));
    } finally {
      setCreating(false);
    }
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    await submitCreate();
  }

  const step1Fields = cfg.createFields.filter((f) => (f.wizardStep ?? 1) === 1);
  const step2Fields = cfg.createFields.filter((f) => f.wizardStep === 2);
  const activeWizardFields =
    wizardStep === 1 ? step1Fields : wizardStep === 2 ? step2Fields : [];

  function renderField(
    field: (typeof cfg.createFields)[number],
    opts?: { readOnly?: boolean },
  ) {
    const id = `ops-create-${module}-${field.name}`;
    const value = form[field.name] ?? "";
    if (opts?.readOnly) {
      return (
        <div className="col-md-6" key={field.name}>
          <dt className="text-muted small mb-0">{field.label}</dt>
          <dd className="mb-2">{value.trim() ? value : "—"}</dd>
        </div>
      );
    }
    const lower = field.name.toLowerCase();
    const longText =
      lower.includes("narrative") ||
      lower.includes("actions") ||
      lower === "description" ||
      lower === "comments" ||
      lower === "sectionresults" ||
      lower === "correctiveaction" ||
      lower === "notes";
    return (
      <div className="col-md-6" key={field.name}>
        <label className="form-label" htmlFor={id}>
          {field.label}
        </label>
        {longText ? (
          <textarea
            id={id}
            className="form-control form-control-sm"
            rows={3}
            required={field.required && (!useWizard || wizardStep < 3)}
            placeholder={field.placeholder}
            value={value}
            onChange={(ev) => setForm((prev) => ({ ...prev, [field.name]: ev.target.value }))}
          />
        ) : (
          <input
            id={id}
            className="form-control form-control-sm"
            type={field.type ?? "text"}
            required={field.required && (!useWizard || wizardStep < 3)}
            placeholder={field.placeholder}
            value={value}
            onChange={(ev) => setForm((prev) => ({ ...prev, [field.name]: ev.target.value }))}
          />
        )}
      </div>
    );
  }

  function canAdvanceWizard(): boolean {
    if (wizardStep === 1) {
      return step1Fields
        .filter((f) => f.required)
        .every((f) => (form[f.name] ?? "").trim().length > 0);
    }
    if (wizardStep === 2) {
      return step2Fields
        .filter((f) => f.required)
        .every((f) => (form[f.name] ?? "").trim().length > 0);
    }
    return true;
  }

  return (
    <div className="ind-ops">
      <PageHeader
        title={moduleName}
        description="List, create, and inspect records for this tenant."
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
          <div className="col-md-5">
            <label className="form-label" htmlFor={`ops-search-${module}`}>
              Search
            </label>
            <input
              id={`ops-search-${module}`}
              className="form-control form-control-sm"
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
              className="form-control form-control-sm"
              type="text"
              value={status}
              onChange={(ev) => setStatus(ev.target.value)}
              placeholder="Optional"
              autoComplete="off"
            />
          </div>
          <div className="col-md-4 d-flex flex-wrap gap-2">
            <button type="submit" className="btn btn-primary btn-sm">
              Apply filters
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
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

        {module === "training" ? (
          <div
            className="d-flex flex-wrap gap-2 mt-3"
            role="group"
            aria-label="Training completion filters"
          >
            {(["all", "Upcoming", "Overdue", "Complete"] as const).map((chip) => (
              <button
                key={chip}
                type="button"
                className={`btn btn-sm ${
                  trainingChip === chip ? "btn-primary" : "btn-outline-secondary"
                }`}
                aria-pressed={trainingChip === chip}
                onClick={() => setTrainingChip(chip)}
              >
                {chip === "all" ? "All" : chip}
              </button>
            ))}
          </div>
        ) : null}
      </PageSection>

      {error ? (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      ) : null}

      <div className="row g-4">
        <div className={selected ? "col-lg-7" : "col-12"}>
          <div className="card mb-0">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h5 className="card-title mb-0">Records</h5>
              {loading ? (
                <span className="text-muted small" role="status" aria-live="polite">
                  Loading…
                </span>
              ) : (
                <span className="text-muted small">{displayedItems.length} shown</span>
              )}
            </div>
            <div className="table-responsive text-nowrap">
              {loading ? null : displayedItems.length === 0 ? (
                <EmptyState
                  title="No records yet"
                  description="When records are created for this module, they will appear here."
                />
              ) : (
                <table className="table table-hover table-sm mb-0" aria-label={`${moduleName} list`}>
                  <thead>
                    <tr>
                      <th>Record</th>
                      <th>Status</th>
                      <th>Updated</th>
                    </tr>
                  </thead>
                  <tbody className="table-border-bottom-0">
                    {displayedItems.map((row) => {
                      const title = String(
                        row[cfg.titleField] ?? row.title ?? row.name ?? row.id ?? "—",
                      );
                      const active = selected && String(selected.id) === String(row.id);
                      return (
                        <tr
                          key={String(row.id)}
                          className={active ? "table-active" : undefined}
                          style={{ cursor: "pointer" }}
                          onClick={() => void openDetail(row)}
                        >
                          <td className="fw-medium">{title}</td>
                          <td>
                            <span className="badge bg-label-secondary">
                              {String(
                                row.completionStatus ?? row.status ?? trainingChipForItem(row) ?? "—",
                              )}
                            </span>
                          </td>
                          <td className="text-muted small">
                            {row.updatedAt
                              ? new Date(String(row.updatedAt)).toLocaleString()
                              : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {selected ? (
          <div className="col-lg-5">
            <div className="card">
              <div className="card-header d-flex justify-content-between align-items-center">
                <h5 className="card-title mb-0">Detail</h5>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => setSelected(null)}
                >
                  Close
                </button>
              </div>
              <div className="card-body">
                <dl className="row mb-3 small">
                  {Object.entries(selected)
                    .filter(([k, v]) => !DETAIL_SKIP.has(k) && v != null && String(v).length > 0)
                    .map(([k, v]) => (
                      <Fragment key={k}>
                        <dt className="col-sm-4 text-muted text-capitalize">{k}</dt>
                        <dd className="col-sm-8">
                          {typeof v === "object" ? JSON.stringify(v) : String(v)}
                        </dd>
                      </Fragment>
                    ))}
                </dl>
                {canManage ? (
                  <div className="d-flex flex-wrap gap-2 align-items-end">
                    <div className="flex-grow-1">
                      <label className="form-label" htmlFor={`ops-detail-status-${module}`}>
                        Status
                      </label>
                      <input
                        id={`ops-detail-status-${module}`}
                        className="form-control form-control-sm"
                        value={statusDraft}
                        onChange={(e) => setStatusDraft(e.target.value)}
                      />
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => void saveStatus()}
                    >
                      Update status
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {canManage ? (
        <PageSection
          title="Create"
          {...(useWizard
            ? {
                description: `Step ${wizardStep} of 3 — ${WIZARD_STEPS[wizardStep - 1]?.label ?? ""}`,
              }
            : {})}
          className="mt-4"
        >
          {useWizard ? (
            <>
              <div
                className="d-flex flex-wrap gap-2 mb-3"
                role="group"
                aria-label="Create progress"
              >
                {WIZARD_STEPS.map(({ step, label }) => (
                  <span
                    key={step}
                    className={`badge ${
                      wizardStep === step
                        ? "bg-primary"
                        : wizardStep > step
                          ? "bg-label-primary"
                          : "bg-label-secondary"
                    }`}
                  >
                    {step}. {label}
                  </span>
                ))}
              </div>

              {wizardStep < 3 ? (
                <form
                  className="row g-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!canAdvanceWizard()) return;
                    setWizardStep((s) => Math.min(3, s + 1));
                  }}
                  aria-label={`Create ${moduleName} step ${wizardStep}`}
                >
                  {activeWizardFields.map((field) => renderField(field))}
                  <div className="col-12 d-flex flex-wrap gap-2">
                    {wizardStep > 1 ? (
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm"
                        onClick={() => setWizardStep((s) => Math.max(1, s - 1))}
                      >
                        Back
                      </button>
                    ) : null}
                    <button type="submit" className="btn btn-primary btn-sm">
                      Next
                    </button>
                  </div>
                </form>
              ) : (
                <div>
                  <div className="row small mb-3">
                    {cfg.createFields.map((field) => renderField(field, { readOnly: true }))}
                  </div>
                  <div className="d-flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() => setWizardStep(2)}
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={creating}
                      onClick={() => void submitCreate()}
                    >
                      {creating ? "Saving…" : "Create"}
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <form className="row g-3" onSubmit={(e) => void onCreate(e)} aria-label="Create record">
              {cfg.createFields.map((field) => renderField(field))}
              <div className="col-12">
                <button type="submit" className="btn btn-primary btn-sm" disabled={creating}>
                  {creating ? "Saving…" : "Create"}
                </button>
              </div>
            </form>
          )}
        </PageSection>
      ) : (
        <p className="text-muted small mt-3">Create/edit requires {cfg.managePerm}.</p>
      )}
    </div>
  );
}
