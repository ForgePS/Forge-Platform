"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ApiError, apiGet, apiSend, useAuth } from "@forge/web-kit";

type QrLink = {
  id: string;
  name: string;
  status: string;
  qrType: string;
  publicTokenHint?: string | null;
  publicToken?: string;
};

const TARGET_TYPES = [
  "industrial.equipment",
  "industrial.loto.procedure",
  "industrial.loto.revision",
  "industrial.jsa",
  "industrial.inspection",
  "industrial.form",
  "industrial.emergency_response",
  "industrial.confined_space",
  "industrial.hot_work",
  "industrial.working_at_heights",
  "industrial.electrical_safety",
  "industrial.cranes_rigging",
  "industrial.machine_safety",
  "industrial.chemical_safety",
  "industrial.contractor_safety",
  "industrial.environmental_safety",
] as const;

export function QrLinksWorkspace({ moduleName }: { moduleName: string }) {
  const { me } = useAuth();
  const permissions = new Set(me?.permissions ?? []);
  const [items, setItems] = useState<QrLink[]>([]);
  const [error, setError] = useState("");
  const [oneTimeToken, setOneTimeToken] = useState<{ id: string; token: string } | null>(null);
  const [form, setForm] = useState({
    name: "",
    targetType: TARGET_TYPES[0],
    targetId: "",
  });

  async function load() {
    try {
      const data = await apiGet<{ items: QrLink[] }>("/api/v1/qr-links");
      setItems(data.items);
      setError("");
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Unable to load QR links");
    }
  }

  useEffect(() => {
    if (permissions.has("qr.view")) void load();
  }, [me]);

  async function create(event: FormEvent) {
    event.preventDefault();
    try {
      const created = await apiSend<QrLink>("/api/v1/qr-links", "POST", {
        name: form.name,
        qrType: "AUTHENTICATED_RECORD",
        isPublic: true,
        target: {
          targetType: form.targetType,
          targetId: form.targetId,
          resolutionMode: "LATEST_PUBLISHED",
        },
      });
      if (created.publicToken) setOneTimeToken({ id: created.id, token: created.publicToken });
      setForm((current) => ({ ...current, name: "", targetId: "" }));
      await load();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Unable to create QR link");
    }
  }

  async function transition(id: string, status: "ACTIVE" | "REVOKED") {
    try {
      await apiSend(`/api/v1/qr-links/${id}/transition`, "POST", { status });
      await load();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Unable to change QR status");
    }
  }

  async function downloadSvg() {
    if (!oneTimeToken) return;
    const response = await apiSend<{ contentType: string; dataBase64: string }>(
      `/api/v1/qr-links/${oneTimeToken.id}/image`,
      "POST",
      { format: "svg", token: oneTimeToken.token },
    );
    const bytes = Uint8Array.from(atob(response.dataBase64), (value) => value.charCodeAt(0));
    const blob = new Blob([bytes], { type: response.contentType });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = `qr-${oneTimeToken.id}.svg`;
    anchor.click();
    URL.revokeObjectURL(href);
  }

  return (
    <section className="ind-ops">
      <header className="ind-ops-header">
        <h1>{moduleName}</h1>
        <p>
          Industrial QR links use one-time public tokens. Save the generated image before leaving.
        </p>
      </header>
      {error && (
        <p role="alert" className="ind-error">
          {error}
        </p>
      )}
      {oneTimeToken && (
        <div className="ind-toolbar" role="status">
          <span>
            Token ending {oneTimeToken.token.slice(-4)} is available only in this session.
          </span>
          <button type="button" onClick={() => void downloadSvg()}>
            Download SVG
          </button>
          <button type="button" onClick={() => setOneTimeToken(null)}>
            Dismiss token
          </button>
        </div>
      )}
      {permissions.has("qr.create") && (
        <form className="ind-form" onSubmit={(event) => void create(event)}>
          <label>
            Link name
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label>
            Target type
            <select
              value={form.targetType}
              onChange={(e) =>
                setForm({ ...form, targetType: e.target.value as typeof form.targetType })
              }
            >
              {TARGET_TYPES.map((targetType) => (
                <option key={targetType}>{targetType}</option>
              ))}
            </select>
          </label>
          <label>
            Target ID
            <input
              required
              value={form.targetId}
              onChange={(e) => setForm({ ...form, targetId: e.target.value })}
            />
          </label>
          <button type="submit">Create QR link</button>
        </form>
      )}
      <div className="ind-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Token hint</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((link) => (
              <tr key={link.id}>
                <td>{link.name}</td>
                <td>{link.qrType}</td>
                <td>{link.publicTokenHint ? `…${link.publicTokenHint}` : "—"}</td>
                <td>{link.status}</td>
                <td>
                  {link.status !== "ACTIVE" && permissions.has("qr.activate") && (
                    <button type="button" onClick={() => void transition(link.id, "ACTIVE")}>
                      Activate
                    </button>
                  )}
                  {link.status !== "REVOKED" && permissions.has("qr.revoke") && (
                    <button type="button" onClick={() => void transition(link.id, "REVOKED")}>
                      Revoke
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
