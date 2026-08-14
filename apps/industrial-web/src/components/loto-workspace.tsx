"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ApiError, apiGet, apiSend, useAuth } from "@forge/web-kit";
import { EmptyState, PageHeader, PageSection } from "@/components/layout/page-chrome";
import { ModuleUnavailable } from "@/components/module-unavailable";
import { FilterPanel } from "@/components/filter-panel";
import { StatusBadge } from "@/components/status-badge";
import { LocalPhotoField } from "@/components/local-photo-field";
import { friendlyActionError, friendlyLoadError } from "@/lib/friendly-error";

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

type LotoTab = "dashboard" | "procedures" | "equipment" | "reviews";

const emptyStep = (): StepForm => ({
  energySourceName: "",
  isolationLocationText: "",
  isolationAction: "",
  verificationMethodName: "",
});

const LOTO_STATUSES = [
  { value: "DRAFT", label: "Draft" },
  { value: "IN_REVIEW", label: "Pending review" },
  { value: "ACTIVE", label: "Active" },
  { value: "ARCHIVED", label: "Archived" },
] as const;

/**
 * Unified LOTO workspace — Dashboard / Procedures / Equipment / Reviews.
 * Keeps procedure create+detail in one module (no fragmented pages).
 */
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

  const [tab, setTab] = useState<LotoTab>("dashboard");
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [equipment, setEquipment] = useState<Array<Record<string, unknown>>>([]);
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [statusDraft, setStatusDraft] = useState("DRAFT");
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [equipmentName, setEquipmentName] = useState("");
  const [equipmentId, setEquipmentId] = useState("");
  const [scope, setScope] = useState("");
  const [steps, setSteps] = useState<StepForm[]>([emptyStep()]);
  const [photo, setPhoto] = useState<{
    fileName: string;
    contentType: string;
    dataUrl: string;
  } | null>(null);

  const modEntry = bootstrap?.modules.find((m) => m.code === "LOCKOUT_TAGOUT");
  const awsReady =
    Boolean(bootstrap?.industrialEnabled) && Boolean(modEntry?.awsEnabled) && canView;

  const kpis = useMemo(() => {
    const draft = items.filter((i) => String(i.status).toUpperCase() === "DRAFT").length;
    const review = items.filter((i) => String(i.status).toUpperCase() === "IN_REVIEW").length;
    const active = items.filter((i) => String(i.status).toUpperCase() === "ACTIVE").length;
    const archived = items.filter((i) => String(i.status).toUpperCase() === "ARCHIVED").length;
    return { total: items.length, draft, review, active, archived };
  }, [items]);

  const filteredItems = useMemo(() => {
    if (!statusFilter) return items;
    return items.filter((i) => String(i.status).toUpperCase() === statusFilter.toUpperCase());
  }, [items, statusFilter]);

  const reviewQueue = useMemo(
    () => items.filter((i) => String(i.status).toUpperCase() === "IN_REVIEW"),
    [items],
  );

  useEffect(() => {
    void apiGet<Bootstrap>("/api/v1/industrial/bootstrap")
      .then(setBootstrap)
      .catch((e) => setError(e instanceof ApiError ? e.message : friendlyLoadError(e)));
  }, []);

  async function loadList(search = q) {
    setLoading(true);
    setError(null);
    try {
      const [loto, equip] = await Promise.all([
        apiGet<ListResponse>("/api/v1/industrial/loto", {
          query: { q: search || undefined, page: "1", pageSize: "50" },
        }),
        apiGet<ListResponse>("/api/v1/industrial/equipment", {
          query: { page: "1", pageSize: "100" },
        }).catch(() => ({ items: [] as Array<Record<string, unknown>>, page: 1, pageSize: 100 })),
      ]);
      setItems(loto.items ?? []);
      setEquipment(equip.items ?? []);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : friendlyLoadError(e));
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
    setTab("procedures");
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
        ...(photo
          ? {
              photoFileName: photo.fileName,
              photoContentType: photo.contentType,
              photoDataUrl: photo.dataUrl,
            }
          : {}),
      });
      setTitle("");
      setEquipmentName("");
      setEquipmentId("");
      setScope("");
      setSteps([emptyStep()]);
      setPhoto(null);
      await loadList();
      if (created?.id) await openDetail(created);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : friendlyActionError(err));
    } finally {
      setCreating(false);
    }
  }

  async function saveStatus(next?: string) {
    if (!canEdit || !selected?.id) return;
    const status = next ?? statusDraft;
    setError(null);
    try {
      const updated = await apiSend<Record<string, unknown>>(
        `/api/v1/industrial/loto/${String(selected.id)}/status`,
        "POST",
        { status },
      );
      setSelected(updated);
      setStatusDraft(status);
      await loadList();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : friendlyActionError(err));
    }
  }

  if (!canView) {
    return (
      <div className="card">
        <div className="card-body">
          <h4 className="card-title mb-2">{moduleName}</h4>
          <p className="mb-0">You don&apos;t have permission to view lockout/tagout.</p>
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

  const chips = [
    ...(q
      ? [{ id: "q", label: `Search: ${q}`, onRemove: () => setQ("") }]
      : []),
    ...(statusFilter
      ? [
          {
            id: "status",
            label: `Status: ${statusFilter}`,
            onRemove: () => setStatusFilter(""),
          },
        ]
      : []),
  ];

  return (
    <div className="ind-loto">
      <PageHeader
        title={moduleName}
        description="Procedures, equipment, energy isolation steps, and review — in one workspace."
        actions={
          canEdit ? (
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={() => {
                setTab("procedures");
                setSelected(null);
              }}
            >
              + New procedure
            </button>
          ) : null
        }
      />

      <div className="btn-group mb-4 flex-wrap" role="tablist" aria-label="LOTO sections">
        {(
          [
            ["dashboard", "Dashboard"],
            ["procedures", "Procedures"],
            ["equipment", "Equipment"],
            ["reviews", "Reviews"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`btn btn-sm ${tab === id ? "btn-primary" : "btn-outline-secondary"}`}
            onClick={() => setTab(id)}
          >
            {label}
            {id === "reviews" && reviewQueue.length > 0 ? (
              <span className="badge bg-label-warning ms-2">{reviewQueue.length}</span>
            ) : null}
          </button>
        ))}
      </div>

      {error ? (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      ) : null}

      {tab === "dashboard" ? (
        <>
          <div className="row g-3 mb-4">
            {(
              [
                ["Total", kpis.total, null],
                ["Drafts", kpis.draft, "DRAFT"],
                ["Pending review", kpis.review, "IN_REVIEW"],
                ["Active", kpis.active, "ACTIVE"],
              ] as const
            ).map(([label, count, filter]) => (
              <div className="col-6 col-md-3" key={label}>
                <button
                  type="button"
                  className="card h-100 w-100 text-start border-0 shadow-none"
                  style={{ cursor: filter ? "pointer" : "default" }}
                  onClick={() => {
                    if (!filter) return;
                    setStatusFilter(filter);
                    setTab("procedures");
                  }}
                >
                  <div className="card-body">
                    <div className="text-muted text-uppercase small">{label}</div>
                    <div className="fw-semibold fs-4">{loading ? "—" : count}</div>
                  </div>
                </button>
              </div>
            ))}
          </div>
          <PageSection title="Needs attention">
            {reviewQueue.length === 0 ? (
              <p className="text-muted small mb-0">No procedures waiting for review.</p>
            ) : (
              <ul className="list-unstyled mb-0">
                {reviewQueue.slice(0, 8).map((row) => (
                  <li key={String(row.id)} className="mb-2">
                    <button
                      type="button"
                      className="btn btn-link btn-sm p-0"
                      onClick={() => void openDetail(row)}
                    >
                      {String(row.title ?? row.displayName ?? "Procedure")}
                    </button>
                    <span className="text-muted small ms-2">
                      {String(row.equipmentName ?? "")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </PageSection>
        </>
      ) : null}

      {tab === "equipment" ? (
        <PageSection
          title="Equipment linked to LOTO"
          description="Assets available for procedure isolation. Manage the full catalog in Assets & Equipment."
          actions={
            <a className="btn btn-sm btn-outline-primary" href="/modules/equipment">
              Open Equipment
            </a>
          }
        >
          {equipment.length === 0 ? (
            <EmptyState
              title="No equipment yet"
              description="Add equipment first, then link it when creating a LOTO procedure."
            />
          ) : (
            <div className="table-responsive">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Equipment</th>
                    <th>Status</th>
                    <th>Linked procedures</th>
                  </tr>
                </thead>
                <tbody>
                  {equipment.map((eq) => {
                    const name = String(eq.equipmentName ?? eq.title ?? eq.id);
                    const linked = items.filter(
                      (i) =>
                        String(i.equipmentId ?? "") === String(eq.id) ||
                        String(i.equipmentName ?? "") === name,
                    ).length;
                    return (
                      <tr key={String(eq.id)}>
                        <td>{name}</td>
                        <td>
                          <StatusBadge status={String(eq.status ?? "ACTIVE")} />
                        </td>
                        <td>{linked}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </PageSection>
      ) : null}

      {tab === "reviews" ? (
        <PageSection title="Pending review">
          {reviewQueue.length === 0 ? (
            <EmptyState
              title="Review queue is clear"
              description="Procedures submitted for review will appear here."
            />
          ) : (
            <div className="table-responsive">
              <table className="table table-sm table-hover">
                <thead>
                  <tr>
                    <th>Procedure</th>
                    <th>Equipment</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {reviewQueue.map((row) => (
                    <tr key={String(row.id)}>
                      <td>{String(row.title ?? row.displayName ?? "—")}</td>
                      <td>{String(row.equipmentName ?? "—")}</td>
                      <td className="text-end">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => void openDetail(row)}
                        >
                          Review
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </PageSection>
      ) : null}

      {tab === "procedures" ? (
        <>
          <FilterPanel
            searchId="loto-search"
            searchValue={q}
            onSearchChange={setQ}
            searchPlaceholder="Title or equipment…"
            statusId="loto-status-filter"
            statusValue={statusFilter}
            onStatusChange={setStatusFilter}
            statusOptions={LOTO_STATUSES.map((s) => ({ value: s.value, label: s.label }))}
            chips={chips}
            onClearAll={() => {
              setQ("");
              setStatusFilter("");
              void loadList("");
            }}
            onSubmit={() => void loadList()}
          />

          <div className="row g-4">
            <div className={selected ? "col-lg-7" : "col-12"}>
              <div className="card mb-0">
                <div className="card-header d-flex justify-content-between align-items-center">
                  <h5 className="card-title mb-0">Procedures</h5>
                  <span className="text-muted small">
                    {loading ? "Loading…" : `${filteredItems.length} shown`}
                  </span>
                </div>
                {loading ? null : filteredItems.length === 0 ? (
                  <EmptyState
                    title="No LOTO procedures yet"
                    description="Create your first lockout/tagout procedure to get started."
                    action={
                      canEdit ? (
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          onClick={() =>
                            document.getElementById("loto-create")?.scrollIntoView({
                              behavior: "smooth",
                            })
                          }
                        >
                          + Create procedure
                        </button>
                      ) : null
                    }
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
                        {filteredItems.map((item) => {
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
                                <StatusBadge status={String(item.status ?? "")} />
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
                    <h5 className="card-title mb-0">Procedure detail</h5>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary"
                      onClick={() => setSelected(null)}
                    >
                      Close
                    </button>
                  </div>
                  <div className="card-body">
                    {typeof selected.photoDataUrl === "string" ? (
                      <img
                        src={String(selected.photoDataUrl)}
                        alt="Procedure attachment"
                        className="rounded border mb-3"
                        style={{ maxWidth: "100%", maxHeight: 160, objectFit: "contain" }}
                      />
                    ) : null}
                    <dl className="row mb-3 small">
                      <dt className="col-sm-4 text-muted">Title</dt>
                      <dd className="col-sm-8">{String(selected.title ?? "—")}</dd>
                      <dt className="col-sm-4 text-muted">Equipment</dt>
                      <dd className="col-sm-8">{String(selected.equipmentName ?? "—")}</dd>
                      <dt className="col-sm-4 text-muted">Scope</dt>
                      <dd className="col-sm-8">{String(selected.scope ?? "—")}</dd>
                      <dt className="col-sm-4 text-muted">Status</dt>
                      <dd className="col-sm-8">
                        <StatusBadge status={String(selected.status ?? "")} />
                      </dd>
                    </dl>
                    {detailSteps.length > 0 ? (
                      <>
                        <h6 className="mb-2">Energy isolation steps</h6>
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
                      </>
                    ) : null}

                    {canEdit ? (
                      <div className="mb-3 p-3 border rounded">
                        <div className="fw-semibold mb-2">Next action</div>
                        <div className="d-flex flex-wrap gap-2">
                          {String(selected.status).toUpperCase() === "DRAFT" ? (
                            <button
                              type="button"
                              className="btn btn-sm btn-primary"
                              onClick={() => void saveStatus("IN_REVIEW")}
                            >
                              Submit for review
                            </button>
                          ) : null}
                          {String(selected.status).toUpperCase() === "IN_REVIEW" ? (
                            <>
                              <button
                                type="button"
                                className="btn btn-sm btn-primary"
                                onClick={() => void saveStatus("ACTIVE")}
                              >
                                Approve &amp; activate
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary"
                                onClick={() => void saveStatus("DRAFT")}
                              >
                                Return to draft
                              </button>
                            </>
                          ) : null}
                          {String(selected.status).toUpperCase() === "ACTIVE" ? (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-secondary"
                              onClick={() => void saveStatus("ARCHIVED")}
                            >
                              Archive
                            </button>
                          ) : null}
                        </div>
                      </div>
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
                              <option key={s.value} value={s.value}>
                                {s.label}
                              </option>
                            ))}
                          </select>
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

          {canEdit ? (
            <div className="card mt-4" id="loto-create">
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
                  <div className="col-12">
                    <LocalPhotoField
                      label="Procedure photo"
                      valueName={photo?.fileName ?? null}
                      valuePreviewUrl={photo?.dataUrl ?? null}
                      onChange={setPhoto}
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
                                    i === idx
                                      ? { ...s, isolationLocationText: ev.target.value }
                                      : s,
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
        </>
      ) : null}
    </div>
  );
}
