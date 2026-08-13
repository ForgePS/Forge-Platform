"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ApiError, apiGet, apiSend, useAuth } from "@forge/web-kit";
import { EmptyState, PageHeader, PageSection } from "@/components/layout/page-chrome";
import { ModuleUnavailable } from "@/components/module-unavailable";

type ListResponse = { items: Array<Record<string, unknown>>; page: number; pageSize: number };
type Bootstrap = {
  industrialEnabled: boolean;
  modules: Array<{ code: string; awsEnabled: boolean; migrationStatus: string }>;
};

type StepForm = {
  energySourceName: string;
  isolationLocationText: string;
  isolationAction: string;
  verificationMethodName: string;
};

const emptyStep = (): StepForm => ({
  energySourceName: "",
  isolationLocationText: "",
  isolationAction: "",
  verificationMethodName: "",
});

const LOTO_STATUSES = ["DRAFT", "IN_REVIEW", "ACTIVE", "ARCHIVED"] as const;

export function LotoWorkspace({ moduleName }: { moduleName: string }) {
  const { me } = useAuth();
  const permissions = new Set(me?.permissions ?? []);
  const canView =
    Boolean(me?.isPlatformAdmin) ||
    permissions.has("industrial.loto.view") ||
    permissions.has("industrial.admin") ||
    permissions.has("industrial.access");
  const canEdit =
    Boolean(me?.isPlatformAdmin) ||
    permissions.has("industrial.loto.edit") ||
    permissions.has("industrial.loto.manage") ||
    permissions.has("industrial.loto.create") ||
    permissions.has("industrial.admin");

  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [equipment, setEquipment] = useState<Array<Record<string, unknown>>>([]);
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [statusDraft, setStatusDraft] = useState("DRAFT");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [equipmentName, setEquipmentName] = useState("");
  const [equipmentId, setEquipmentId] = useState("");
  const [scope, setScope] = useState("");
  const [steps, setSteps] = useState<StepForm[]>([emptyStep()]);

  const modEntry = bootstrap?.modules.find((m) => m.code === "LOCKOUT_TAGOUT");
  const awsReady =
    Boolean(bootstrap?.industrialEnabled) && Boolean(modEntry?.awsEnabled) && canView;

  useEffect(() => {
    void apiGet<Bootstrap>("/api/v1/industrial/bootstrap")
      .then(setBootstrap)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Bootstrap failed"));
  }, []);

  async function loadList() {
    setLoading(true);
    setError(null);
    try {
      const [loto, equip] = await Promise.all([
        apiGet<ListResponse>("/api/v1/industrial/loto", {
          query: { q: q || undefined, page: "1", pageSize: "25" },
        }),
        apiGet<ListResponse>("/api/v1/industrial/equipment", {
          query: { page: "1", pageSize: "100" },
        }).catch(() => ({ items: [] as Array<Record<string, unknown>>, page: 1, pageSize: 100 })),
      ]);
      setItems(loto.items ?? []);
      setEquipment(equip.items ?? []);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load LOTO");
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
    void loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [awsReady]);

  async function openDetail(row: Record<string, unknown>) {
    setSelected(row);
    setStatusDraft(String(row.status ?? "DRAFT"));
    try {
      const data = await apiGet<Record<string, unknown>>(
        `/api/v1/industrial/loto/${String(row.id)}`,
      );
      setSelected(data);
      setStatusDraft(String(data.status ?? "DRAFT"));
    } catch {
      // List payload is enough.
    }
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    setCreating(true);
    setError(null);
    try {
      const created = await apiSend<Record<string, unknown>>("/api/v1/industrial/loto", "POST", {
        title: title || undefined,
        equipmentName,
        equipmentId: equipmentId || null,
        scope,
        status: "DRAFT",
        steps: steps.map((s, i) => ({
          stepNumber: i + 1,
          ...s,
        })),
      });
      setTitle("");
      setEquipmentName("");
      setEquipmentId("");
      setScope("");
      setSteps([emptyStep()]);
      await loadList();
      if (created?.id) await openDetail(created);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }

  async function saveStatus() {
    if (!canEdit || !selected?.id) return;
    setError(null);
    try {
      const updated = await apiSend<Record<string, unknown>>(
        `/api/v1/industrial/loto/${String(selected.id)}/status`,
        "POST",
        { status: statusDraft },
      );
      setSelected(updated);
      await loadList();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Status update failed");
    }
  }

  if (!canView) {
    return (
      <div className="card">
        <div className="card-body">
          <h4 className="card-title mb-2">{moduleName}</h4>
          <p className="mb-0">You do not have permission to view lockout/tagout.</p>
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
      <div className="card">
        <div className="card-body">
          <h4 className="card-title mb-2">{moduleName}</h4>
          <p className="text-muted mb-0">Checking module availability…</p>
        </div>
      </div>
    );
  }

  const detailSteps = (Array.isArray(selected?.steps) ? selected.steps : []) as Array<
    Record<string, unknown>
  >;

  return (
    <div className="ind-ops">
      <PageHeader
        title={moduleName}
        description="Draft procedures with isolation steps and status tracking (MVP)."
      />

      <PageSection title="Filters" bodyClassName="pt-3">
        <form
          className="row g-3 align-items-end"
          onSubmit={(e) => {
            e.preventDefault();
            void loadList();
          }}
        >
          <div className="col-md-8">
            <label className="form-label" htmlFor="loto-search">
              Search
            </label>
            <input
              id="loto-search"
              className="form-control form-control-sm"
              value={q}
              onChange={(ev) => setQ(ev.target.value)}
              placeholder="Title or equipment…"
              autoComplete="off"
            />
          </div>
          <div className="col-md-4">
            <button type="submit" className="btn btn-primary btn-sm" disabled={loading}>
              Apply
            </button>
          </div>
        </form>
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
              <h5 className="card-title mb-0">Procedures</h5>
              <span className="text-muted small">
                {loading ? "Loading…" : `${items.length} shown`}
              </span>
            </div>
            {loading ? null : items.length === 0 ? (
              <EmptyState
                title="No LOTO procedures yet"
                description="Created lockout/tagout procedures for this tenant will appear here."
              />
            ) : (
              <div className="table-responsive text-nowrap">
                <table className="table table-hover table-sm mb-0">
                  <thead>
                    <tr>
                      <th>Procedure</th>
                      <th>Equipment</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody className="table-border-bottom-0">
                    {items.map((item) => {
                      const active = selected && String(selected.id) === String(item.id);
                      return (
                        <tr
                          key={String(item.id)}
                          className={active ? "table-active" : undefined}
                          style={{ cursor: "pointer" }}
                          onClick={() => void openDetail(item)}
                        >
                          <td className="fw-medium">
                            {String(item.title ?? item.displayName ?? item.id)}
                          </td>
                          <td>{String(item.equipmentName ?? "—")}</td>
                          <td>
                            <span className="badge bg-label-secondary">
                              {String(item.status ?? "—")}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
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
                  <dt className="col-sm-4 text-muted">Title</dt>
                  <dd className="col-sm-8">{String(selected.title ?? "—")}</dd>
                  <dt className="col-sm-4 text-muted">Equipment</dt>
                  <dd className="col-sm-8">{String(selected.equipmentName ?? "—")}</dd>
                  <dt className="col-sm-4 text-muted">Scope</dt>
                  <dd className="col-sm-8">{String(selected.scope ?? "—")}</dd>
                </dl>
                {detailSteps.length > 0 ? (
                  <ol className="small mb-3">
                    {detailSteps.map((s, idx) => (
                      <li key={String(s.stepNumber ?? idx)}>
                        {String(s.energySourceName)}
                        {s.isolationLocationText
                          ? ` @ ${String(s.isolationLocationText)}`
                          : ""}
                        {s.verificationMethodName
                          ? ` — verify ${String(s.verificationMethodName)}`
                          : ""}
                      </li>
                    ))}
                  </ol>
                ) : null}
                {canEdit ? (
                  <div className="d-flex flex-wrap gap-2 align-items-end">
                    <div className="flex-grow-1">
                      <label className="form-label" htmlFor="loto-status">
                        Status
                      </label>
                      <select
                        id="loto-status"
                        className="form-select form-select-sm"
                        value={statusDraft}
                        onChange={(e) => setStatusDraft(e.target.value)}
                      >
                        {LOTO_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => void saveStatus()}>
                      Update status
                    </button>
                  </div>
                ) : null}

                <div className="mt-4 pt-3 border-top">
                  <h6 className="mb-3">Record history</h6>
                  <ol className="list-unstyled small mb-0">
                    <li className="mb-2 d-flex gap-2">
                      <span className="text-muted" aria-hidden="true">
                        •
                      </span>
                      <div>
                        <div className="fw-medium">Created</div>
                        <div className="text-muted">
                          {selected.createdAt
                            ? new Date(String(selected.createdAt)).toLocaleString()
                            : "Timestamp not available"}
                        </div>
                      </div>
                    </li>
                    <li className="mb-2 d-flex gap-2">
                      <span className="text-muted" aria-hidden="true">
                        •
                      </span>
                      <div>
                        <div className="fw-medium">Last updated</div>
                        <div className="text-muted">
                          {selected.updatedAt
                            ? new Date(String(selected.updatedAt)).toLocaleString()
                            : "Timestamp not available"}
                        </div>
                      </div>
                    </li>
                    <li className="d-flex gap-2">
                      <span className="text-muted" aria-hidden="true">
                        •
                      </span>
                      <div>
                        <div className="fw-medium">Current status</div>
                        <div className="text-muted">{String(selected.status ?? statusDraft ?? "—")}</div>
                      </div>
                    </li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {canEdit ? (
        <div className="card mt-4">
          <div className="card-header">
            <h5 className="card-title mb-0">Create procedure</h5>
          </div>
          <div className="card-body">
            <form className="row g-3" onSubmit={(e) => void onCreate(e)}>
              <div className="col-md-6">
                <label className="form-label" htmlFor="loto-title">
                  Title
                </label>
                <input
                  id="loto-title"
                  className="form-control form-control-sm"
                  value={title}
                  onChange={(ev) => setTitle(ev.target.value)}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label" htmlFor="loto-equip-name">
                  Equipment name *
                </label>
                <input
                  id="loto-equip-name"
                  className="form-control form-control-sm"
                  required
                  value={equipmentName}
                  onChange={(ev) => setEquipmentName(ev.target.value)}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label" htmlFor="loto-equip-link">
                  Link equipment
                </label>
                <select
                  id="loto-equip-link"
                  className="form-select form-select-sm"
                  value={equipmentId}
                  onChange={(ev) => {
                    const id = ev.target.value;
                    setEquipmentId(id);
                    const match = equipment.find((x) => String(x.id) === id);
                    if (match?.equipmentName) setEquipmentName(String(match.equipmentName));
                  }}
                >
                  <option value="">— optional —</option>
                  {equipment.map((eq) => (
                    <option key={String(eq.id)} value={String(eq.id)}>
                      {String(eq.equipmentName ?? eq.title)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-12">
                <label className="form-label" htmlFor="loto-scope">
                  Scope
                </label>
                <textarea
                  id="loto-scope"
                  className="form-control form-control-sm"
                  rows={2}
                  value={scope}
                  onChange={(ev) => setScope(ev.target.value)}
                />
              </div>

              {steps.map((step, idx) => (
                <div className="col-12" key={idx}>
                  <div className="border rounded p-3">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <strong className="small">Step {idx + 1}</strong>
                      {steps.length > 1 ? (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => setSteps((prev) => prev.filter((_, i) => i !== idx))}
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                    <div className="row g-2">
                      <div className="col-md-6">
                        <label className="form-label" htmlFor={`loto-step-energy-${idx}`}>
                          Energy source *
                        </label>
                        <input
                          id={`loto-step-energy-${idx}`}
                          className="form-control form-control-sm"
                          required
                          value={step.energySourceName}
                          onChange={(ev) =>
                            setSteps((prev) =>
                              prev.map((s, i) =>
                                i === idx ? { ...s, energySourceName: ev.target.value } : s,
                              ),
                            )
                          }
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label" htmlFor={`loto-step-loc-${idx}`}>
                          Isolation location
                        </label>
                        <input
                          id={`loto-step-loc-${idx}`}
                          className="form-control form-control-sm"
                          value={step.isolationLocationText}
                          onChange={(ev) =>
                            setSteps((prev) =>
                              prev.map((s, i) =>
                                i === idx ? { ...s, isolationLocationText: ev.target.value } : s,
                              ),
                            )
                          }
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label" htmlFor={`loto-step-action-${idx}`}>
                          Lockout method
                        </label>
                        <input
                          id={`loto-step-action-${idx}`}
                          className="form-control form-control-sm"
                          value={step.isolationAction}
                          onChange={(ev) =>
                            setSteps((prev) =>
                              prev.map((s, i) =>
                                i === idx ? { ...s, isolationAction: ev.target.value } : s,
                              ),
                            )
                          }
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label" htmlFor={`loto-step-verify-${idx}`}>
                          Verification
                        </label>
                        <input
                          id={`loto-step-verify-${idx}`}
                          className="form-control form-control-sm"
                          value={step.verificationMethodName}
                          onChange={(ev) =>
                            setSteps((prev) =>
                              prev.map((s, i) =>
                                i === idx
                                  ? { ...s, verificationMethodName: ev.target.value }
                                  : s,
                              ),
                            )
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              <div className="col-12 d-flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => setSteps((prev) => [...prev, emptyStep()])}
                >
                  Add step
                </button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={creating}>
                  {creating ? "Saving…" : "Create draft"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
