"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ApiError, apiGet, apiSend, useAuth } from "@forge/web-kit";
import { ModuleUnavailable } from "@/components/module-unavailable";

type ListResponse = { items: Array<Record<string, unknown>>; page: number; pageSize: number };
type Bootstrap = {
  industrialEnabled: boolean;
  modules: Array<{ code: string; awsEnabled: boolean; migrationStatus: string }>;
};

export function EquipmentWorkspace({ moduleName }: { moduleName: string }) {
  const { me } = useAuth();
  const permissions = new Set(me?.permissions ?? []);
  const canView =
    permissions.has("industrial.equipment.view") || permissions.has("industrial.admin");
  const canManage =
    permissions.has("industrial.equipment.manage") || permissions.has("industrial.admin");

  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [sites, setSites] = useState<Array<Record<string, unknown>>>([]);
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
        }),
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
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Archive failed");
    }
  }

  if (!awsReady && bootstrap) {
    return (
      <ModuleUnavailable
        moduleName={moduleName}
        status={modEntry?.migrationStatus ?? "LEGACY_FIREBASE"}
      />
    );
  }

  return (
    <section className="ops-workspace equipment-workspace">
      <header className="ops-workspace__header">
        <h1>{moduleName}</h1>
        <p>Site / area hierarchy, equipment identity, and LOTO association indicators.</p>
      </header>

      {error ? <p role="alert">{error}</p> : null}

      <div className="ops-workspace__toolbar">
        <label>
          Search
          <input
            value={q}
            onChange={(ev) => setQ(ev.target.value)}
            placeholder="Name, tag, serial…"
          />
        </label>
        <button type="button" onClick={() => void load()} disabled={loading}>
          Refresh
        </button>
      </div>

      {canManage ? (
        <form className="ops-workspace__create" onSubmit={(e) => void onCreate(e)}>
          <h2>Create equipment</h2>
          <label>
            Name *
            <input
              required
              value={form.equipmentName}
              onChange={(ev) => setForm((f) => ({ ...f, equipmentName: ev.target.value }))}
            />
          </label>
          <label>
            External ID
            <input
              value={form.externalEquipmentId}
              onChange={(ev) => setForm((f) => ({ ...f, externalEquipmentId: ev.target.value }))}
            />
          </label>
          <label>
            Site
            <select
              value={form.siteId}
              onChange={(ev) => setForm((f) => ({ ...f, siteId: ev.target.value }))}
            >
              <option value="">—</option>
              {sites.map((s) => (
                <option key={String(s.id)} value={String(s.id)}>
                  {String(s.name)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Manufacturer
            <input
              value={form.manufacturer}
              onChange={(ev) => setForm((f) => ({ ...f, manufacturer: ev.target.value }))}
            />
          </label>
          <label>
            Model
            <input
              value={form.model}
              onChange={(ev) => setForm((f) => ({ ...f, model: ev.target.value }))}
            />
          </label>
          <label>
            Serial
            <input
              value={form.serialNumber}
              onChange={(ev) => setForm((f) => ({ ...f, serialNumber: ev.target.value }))}
            />
          </label>
          <label>
            Location detail
            <input
              value={form.locationDetail}
              onChange={(ev) => setForm((f) => ({ ...f, locationDetail: ev.target.value }))}
            />
          </label>
          <button type="submit" disabled={creating}>
            {creating ? "Saving…" : "Create"}
          </button>
        </form>
      ) : null}

      {loading ? <p>Loading…</p> : null}
      {!loading && items.length === 0 ? <p>No equipment records.</p> : null}

      <ul className="ops-workspace__list">
        {items.map((item) => (
          <li key={String(item.id)}>
            <strong>{String(item.equipmentName)}</strong>
            <span> · {String(item.externalEquipmentId || item.assetTag || "no ID")}</span>
            <span> · {String(item.status)}</span>
            {canManage ? (
              <button type="button" onClick={() => void archive(String(item.id))}>
                Archive
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
