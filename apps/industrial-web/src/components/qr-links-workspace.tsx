"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ApiError, apiGet, apiSend, useAuth } from "@forge/web-kit";
import { EmptyState, PageHeader, PageSection } from "@/components/layout/page-chrome";

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
  const [loading, setLoading] = useState(true);
  const [oneTimeToken, setOneTimeToken] = useState<{ id: string; token: string } | null>(null);
  const [form, setForm] = useState({
    name: "",
    targetType: TARGET_TYPES[0],
    targetId: "",
  });

  async function load() {
    setLoading(true);
    try {
      const data = await apiGet<{ items: QrLink[] }>("/api/v1/qr-links");
      setItems(data.items);
      setError("");
    } catch (cause) {
      setItems([]);
      setError(cause instanceof ApiError ? cause.message : "Unable to load QR links");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (permissions.has("qr.view") || me?.isPlatformAdmin) void load();
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.tenantId]);

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
    <div className="ind-ops">
      <PageHeader
        title={moduleName}
        description="Industrial QR links use one-time public tokens. Save the generated image before leaving."
      />

      {error ? (
        <div className="alert alert-warning" role="alert">
          {error}
        </div>
      ) : null}

      {oneTimeToken ? (
        <div className="alert alert-info d-flex flex-wrap gap-2 align-items-center" role="status">
          <span>Token ending {oneTimeToken.token.slice(-4)} is available only in this session.</span>
          <button type="button" className="btn btn-sm btn-primary" onClick={() => void downloadSvg()}>
            Download SVG
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={() => setOneTimeToken(null)}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {permissions.has("qr.create") || me?.isPlatformAdmin ? (
        <PageSection title="Create QR link">
          <form className="row g-3" onSubmit={(event) => void create(event)}>
            <div className="col-md-4">
              <label className="form-label" htmlFor="qr-name">
                Link name
              </label>
              <input
                id="qr-name"
                className="form-control form-control-sm"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="col-md-4">
              <label className="form-label" htmlFor="qr-target-type">
                Target type
              </label>
              <select
                id="qr-target-type"
                className="form-select form-select-sm"
                value={form.targetType}
                onChange={(e) =>
                  setForm({ ...form, targetType: e.target.value as typeof form.targetType })
                }
              >
                {TARGET_TYPES.map((targetType) => (
                  <option key={targetType}>{targetType}</option>
                ))}
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label" htmlFor="qr-target-id">
                Target ID
              </label>
              <input
                id="qr-target-id"
                className="form-control form-control-sm"
                required
                value={form.targetId}
                onChange={(e) => setForm({ ...form, targetId: e.target.value })}
              />
            </div>
            <div className="col-12">
              <button type="submit" className="btn btn-primary btn-sm">
                Create QR link
              </button>
            </div>
          </form>
        </PageSection>
      ) : null}

      <div className="card">
        <div className="card-header">
          <h5 className="card-title mb-0">QR links</h5>
        </div>
        {loading ? (
          <div className="card-body text-muted">Loading…</div>
        ) : items.length === 0 ? (
          <EmptyState
            title="No QR links yet"
            description="Created QR links for this tenant will appear here."
          />
        ) : (
          <div className="table-responsive text-nowrap">
            <table className="table table-sm mb-0">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Token hint</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody className="table-border-bottom-0">
                {items.map((link) => (
                  <tr key={link.id}>
                    <td className="fw-medium">{link.name}</td>
                    <td>{link.qrType}</td>
                    <td>{link.publicTokenHint ? `…${link.publicTokenHint}` : "—"}</td>
                    <td>
                      <span className="badge bg-label-secondary">{link.status}</span>
                    </td>
                    <td className="d-flex gap-1">
                      {link.status !== "ACTIVE" && permissions.has("qr.activate") ? (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => void transition(link.id, "ACTIVE")}
                        >
                          Activate
                        </button>
                      ) : null}
                      {link.status !== "REVOKED" && permissions.has("qr.revoke") ? (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => void transition(link.id, "REVOKED")}
                        >
                          Revoke
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
