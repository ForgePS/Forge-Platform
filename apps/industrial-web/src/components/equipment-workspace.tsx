"use client";

import { Fragment, useEffect, useState, type FormEvent } from "react";
import { ApiError, apiGet, apiSend, useAuth } from "@forge/web-kit";
import { EmptyState, PageHeader, PageSection } from "@/components/layout/page-chrome";
import { ModuleUnavailable } from "@/components/module-unavailable";

type ListResponse = { items: Array<Record<string, unknown>>; page: number; pageSize: number };
type Bootstrap = {
  industrialEnabled: boolean;
  modules: Array<{ code: string; awsEnabled: boolean; migrationStatus: string }>;
};

const DETAIL_SKIP = new Set([
  "id",
  "module",
  "recordVersion",
  "createdAt",
  "updatedAt",
  "displayName",
]);

export function EquipmentWorkspace({ moduleName }: { moduleName: string }) {
  const { me } = useAuth();
  const permissions = new Set(me?.permissions ?? []);
  const canView =
    Boolean(me?.isPlatformAdmin) ||
    permissions.has("industrial.equipment.view") ||
    permissions.has("industrial.admin") ||
    permissions.has("industrial.access");
  const canManage =
    Boolean(me?.isPlatformAdmin) ||
    permissions.has("industrial.equipment.manage") ||
    permissions.has("industrial.admin");

  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [sites, setSites] = useState<Array<Record<string, unknown>>>([]);
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    equipmentName: "",
    externalEquipmentId: "",
    manufacturer: "",
    model: "",
    serialNumber: "",
    siteId: "",
    locationDetail: "",
  });

  const modEntry = bootstrap?.modules.find((m) => m.code === "EQUIPMENT");
  const awsReady =
    Boolean(bootstrap?.industrialEnabled) && Boolean(modEntry?.awsEnabled) && canView;

  useEffect(() => {
    void apiGet<Bootstrap>("/api/v1/industrial/bootstrap")
      .then(setBootstrap)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Bootstrap failed"));
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [equip, siteList] = await Promise.all([
        apiGet<ListResponse>("/api/v1/industrial/equipment", {
          query: { q: q || undefined, page: "1", pageSize: "25" },
        }),
        apiGet<ListResponse>("/api/v1/industrial/sites", {
          query: { page: "1", pageSize: "100" },
        }).catch(() => ({ items: [] as Array<Record<string, unknown>>, page: 1, pageSize: 100 })),
      ]);
      setItems(equip.items ?? []);
      setSites(siteList.items ?? []);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load equipment");
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
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [awsReady]);

  async function openDetail(row: Record<string, unknown>) {
    setSelected(row);
    try {
      const data = await apiGet<Record<string, unknown>>(
        `/api/v1/industrial/equipment/${String(row.id)}`,
      );
      setSelected(data);
    } catch {
      // List row is enough when get fails.
    }
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!canManage) return;
    setCreating(true);
    setError(null);
    try {
      await apiSend("/api/v1/industrial/equipment", "POST", {
        equipmentName: form.equipmentName,
        externalEquipmentId: form.externalEquipmentId || null,
        manufacturer: form.manufacturer || null,
        model: form.model || null,
        serialNumber: form.serialNumber || null,
        siteId: form.siteId || null,
        locationDetail: form.locationDetail || null,
      });
      setForm({
        equipmentName: "",
        externalEquipmentId: "",
        manufacturer: "",
        model: "",
        serialNumber: "",
        siteId: "",
        locationDetail: "",
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }

  async function archive(id: string) {
    if (!canManage) return;
    try {
      await apiSend(`/api/v1/industrial/equipment/${id}/archive`, "POST", {});
      if (selected && String(selected.id) === id) setSelected(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Archive failed");
    }
  }

  if (!canView) {
    return (
      <div className="card">
        <div className="card-body">
          <h4 className="card-title mb-2">{moduleName}</h4>
          <p className="mb-0">You do not have permission to view equipment.</p>
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

  return (
    <div className="ind-ops">
      <PageHeader
        title={moduleName}
        description="Equipment identity, site links, and LOTO association targets."
      />

      <PageSection title="Filters" bodyClassName="pt-3">
        <form
          className="row g-3 align-items-end"
          onSubmit={(e) => {
            e.preventDefault();
            void load();
          }}
        >
          <div className="col-md-8">
            <label className="form-label" htmlFor="equip-search">
              Search
            </label>
            <input
              id="equip-search"
              className="form-control form-control-sm"
              value={q}
              onChange={(ev) => setQ(ev.target.value)}
              placeholder="Name, tag, serial…"
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
              <h5 className="card-title mb-0">Equipment</h5>
              <span className="text-muted small">
                {loading ? "Loading…" : `${items.length} shown`}
              </span>
            </div>
            {loading ? null : items.length === 0 ? (
              <EmptyState
                title="No equipment records yet"
                description="Created equipment for this tenant will appear here."
              />
            ) : (
              <div className="table-responsive text-nowrap">
                <table className="table table-hover table-sm mb-0">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>ID / tag</th>
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
                          <td className="fw-medium">{String(item.equipmentName ?? item.title)}</td>
                          <td>
                            {String(item.externalEquipmentId || item.assetTag || "—")}
                          </td>
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
                  <button
                    type="button"
                    className="btn btn-outline-danger btn-sm"
                    onClick={() => void archive(String(selected.id))}
                  >
                    Archive
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {canManage ? (
        <div className="card mt-4">
          <div className="card-header">
            <h5 className="card-title mb-0">Create equipment</h5>
          </div>
          <div className="card-body">
            <form className="row g-3" onSubmit={(e) => void onCreate(e)}>
              <div className="col-md-6">
                <label className="form-label" htmlFor="equip-name">
                  Name *
                </label>
                <input
                  id="equip-name"
                  className="form-control form-control-sm"
                  required
                  value={form.equipmentName}
                  onChange={(ev) => setForm((f) => ({ ...f, equipmentName: ev.target.value }))}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label" htmlFor="equip-ext">
                  External ID
                </label>
                <input
                  id="equip-ext"
                  className="form-control form-control-sm"
                  value={form.externalEquipmentId}
                  onChange={(ev) =>
                    setForm((f) => ({ ...f, externalEquipmentId: ev.target.value }))
                  }
                />
              </div>
              <div className="col-md-6">
                <label className="form-label" htmlFor="equip-site">
                  Site
                </label>
                <select
                  id="equip-site"
                  className="form-select form-select-sm"
                  value={form.siteId}
                  onChange={(ev) => setForm((f) => ({ ...f, siteId: ev.target.value }))}
                >
                  <option value="">—</option>
                  {sites.map((s) => (
                    <option key={String(s.id)} value={String(s.id)}>
                      {String(s.name ?? s.title ?? s.id)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label" htmlFor="equip-mfr">
                  Manufacturer
                </label>
                <input
                  id="equip-mfr"
                  className="form-control form-control-sm"
                  value={form.manufacturer}
                  onChange={(ev) => setForm((f) => ({ ...f, manufacturer: ev.target.value }))}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label" htmlFor="equip-model">
                  Model
                </label>
                <input
                  id="equip-model"
                  className="form-control form-control-sm"
                  value={form.model}
                  onChange={(ev) => setForm((f) => ({ ...f, model: ev.target.value }))}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label" htmlFor="equip-serial">
                  Serial
                </label>
                <input
                  id="equip-serial"
                  className="form-control form-control-sm"
                  value={form.serialNumber}
                  onChange={(ev) => setForm((f) => ({ ...f, serialNumber: ev.target.value }))}
                />
              </div>
              <div className="col-12">
                <label className="form-label" htmlFor="equip-loc">
                  Location detail
                </label>
                <input
                  id="equip-loc"
                  className="form-control form-control-sm"
                  value={form.locationDetail}
                  onChange={(ev) => setForm((f) => ({ ...f, locationDetail: ev.target.value }))}
                />
              </div>
              <div className="col-12">
                <button type="submit" className="btn btn-primary btn-sm" disabled={creating}>
                  {creating ? "Saving…" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
