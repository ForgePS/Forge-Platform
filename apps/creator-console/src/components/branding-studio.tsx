"use client";

import {
  CreatorLoading,
  CreatorPage,
  ForgePageSection,
  ForgeStatusBadge,
} from "@/components/creator-page";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { TenantRequired } from "@/components/tenant-required";
import { useAuth } from "@/hooks/use-auth";
import { tenantQuery, useTenantId, tenantDetailHref } from "@/hooks/use-tenant-id";
import { apiGet, apiSend } from "@/lib/api";
import { ImageUpload } from "@/components/image-upload";
import styles from "../app/page.module.css";

type StudioVersion = {
  id: string;
  version: number;
  state: string;
  payloadJson: unknown;
  changeSummary: string | null;
  createdAt: string;
};

type StudioObject = {
  id: string;
  namespace: string;
  objectKey: string;
  displayName: string;
};

export type LoginBrandingPayload = {
  logoUrl?: string;
  brandLabel?: string;
  headline?: string;
  body?: string;
  statusText?: string;
  buttonLabel?: string;
};

export type BrandingPayload = {
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  logoUrl?: string;
  iconUrl?: string;
  productDisplayName?: string;
  appShortName?: string;
  /** @deprecated Prefer login.brandLabel; retained when saving for older clients. */
  loginShortName?: string;
  login?: LoginBrandingPayload;
  emailFromName?: string;
  emailFromAddress?: string;
  customCss?: string;
};

const EMPTY_LOGIN: LoginBrandingPayload = {
  logoUrl: "",
  brandLabel: "Industrial",
  headline: "Welcome to Forge Industrial Safety",
  body: "Sign in is required to continue.",
  statusText: "Unauthenticated",
  buttonLabel: "Sign in",
};

const EMPTY: BrandingPayload = {
  primaryColor: "#696cff",
  secondaryColor: "#8592a3",
  accentColor: "#696cff",
  logoUrl: "",
  iconUrl: "",
  productDisplayName: "Forge Industrial Safety",
  appShortName: "Bridge",
  loginShortName: "Industrial",
  login: { ...EMPTY_LOGIN },
  emailFromName: "Forge",
  emailFromAddress: "",
};

function asPayload(value: unknown): BrandingPayload {
  if (!value || typeof value !== "object") return { ...EMPTY, login: { ...EMPTY_LOGIN } };
  const raw = value as BrandingPayload;
  const loginRaw = raw.login && typeof raw.login === "object" ? raw.login : {};
  const brandLabel: string =
    (typeof loginRaw.brandLabel === "string" && loginRaw.brandLabel.trim()) ||
    (typeof raw.loginShortName === "string" && raw.loginShortName.trim()) ||
    EMPTY_LOGIN.brandLabel!;
  const login: LoginBrandingPayload = {
    logoUrl: (typeof loginRaw.logoUrl === "string" && loginRaw.logoUrl.trim()) || "",
    brandLabel,
    headline:
      (typeof loginRaw.headline === "string" && loginRaw.headline.trim()) ||
      EMPTY_LOGIN.headline ||
      "",
    body:
      (typeof loginRaw.body === "string" && loginRaw.body.trim()) || EMPTY_LOGIN.body || "",
    statusText:
      (typeof loginRaw.statusText === "string" && loginRaw.statusText.trim()) ||
      EMPTY_LOGIN.statusText ||
      "",
    buttonLabel:
      (typeof loginRaw.buttonLabel === "string" && loginRaw.buttonLabel.trim()) ||
      EMPTY_LOGIN.buttonLabel ||
      "",
  };
  return {
    ...EMPTY,
    ...raw,
    login,
    loginShortName: raw.loginShortName ?? brandLabel,
  };
}

function payloadFromForm(form: BrandingPayload, payloadText: string, showAdvanced: boolean): BrandingPayload {
  if (showAdvanced) {
    return asPayload(JSON.parse(payloadText) as unknown);
  }
  const next: BrandingPayload = {};
  const logoUrl = form.logoUrl?.trim() ?? "";
  if (logoUrl) next.logoUrl = logoUrl;
  const iconUrl = form.iconUrl?.trim() ?? "";
  if (iconUrl) next.iconUrl = iconUrl;
  const productDisplayName = form.productDisplayName?.trim();
  if (productDisplayName) next.productDisplayName = productDisplayName;
  const appShortName = form.appShortName?.trim();
  if (appShortName) next.appShortName = appShortName;
  const emailFromName = form.emailFromName?.trim();
  if (emailFromName) next.emailFromName = emailFromName;
  const emailFromAddress = form.emailFromAddress?.trim() ?? "";
  if (emailFromAddress) next.emailFromAddress = emailFromAddress;
  const primaryColor = form.primaryColor?.trim();
  if (primaryColor) next.primaryColor = primaryColor;
  const secondaryColor = form.secondaryColor?.trim();
  if (secondaryColor) next.secondaryColor = secondaryColor;
  const accentColor = form.accentColor?.trim();
  if (accentColor) next.accentColor = accentColor;
  if (form.customCss?.trim()) next.customCss = form.customCss.trim();

  const loginIn = form.login ?? {};
  const login: LoginBrandingPayload = {};
  const loginLogo = loginIn.logoUrl?.trim() ?? "";
  if (loginLogo) login.logoUrl = loginLogo;
  const brandLabel = loginIn.brandLabel?.trim();
  if (brandLabel) login.brandLabel = brandLabel;
  const headline = loginIn.headline?.trim();
  if (headline) login.headline = headline;
  const body = loginIn.body?.trim();
  if (body) login.body = body;
  const statusText = loginIn.statusText?.trim();
  if (statusText) login.statusText = statusText;
  const buttonLabel = loginIn.buttonLabel?.trim();
  if (buttonLabel) login.buttonLabel = buttonLabel;
  if (Object.keys(login).length > 0) {
    next.login = login;
    // Keep flat field in sync for older payloads/readers.
    if (login.brandLabel) next.loginShortName = login.brandLabel;
  }
  return next;
}

function BrandingStudioInner() {
  const tenantId = useTenantId();
  const { hasPermission } = useAuth();
  const canUpdate =
    hasPermission("platform.configuration.update") || hasPermission("tenant.configuration.update");
  const canPublish =
    hasPermission("platform.configuration.publish") ||
    hasPermission("platform.configuration.update") ||
    hasPermission("tenant.configuration.publish");

  const [object, setObject] = useState<StudioObject | null>(null);
  const [versions, setVersions] = useState<StudioVersion[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<BrandingPayload>({ ...EMPTY });
  const [changeSummary, setChangeSummary] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [payloadText, setPayloadText] = useState("{}");
  const [loading, setLoading] = useState(Boolean(tenantId));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const selected = useMemo(
    () => versions.find((v) => v.id === selectedId) ?? null,
    [versions, selectedId],
  );
  const draftSelected = selected?.state === "DRAFT";

  const load = useCallback(async () => {
    if (!tenantId || !canUpdate) return;
    setLoading(true);
    setError(null);
    try {
      await apiSend(`/api/v1/tenants/${tenantId}/config/ensure-defaults`, "POST");
      const listed = await apiGet<{ items: StudioObject[] }>(
        `/api/v1/tenants/${tenantId}/config/branding`,
      );
      const target =
        listed.items.find((item) => item.objectKey === "default") ?? listed.items[0] ?? null;
      setObject(target);
      if (!target) {
        setVersions([]);
        setForm({ ...EMPTY });
        return;
      }
      const history = await apiGet<{ object: StudioObject; versions: StudioVersion[] }>(
        `/api/v1/tenants/${tenantId}/config/branding/${target.objectKey}/versions`,
      );
      setObject(history.object);
      setVersions(history.versions);
      const draft =
        history.versions.find((v) => v.state === "DRAFT") ?? history.versions[0] ?? null;
      setSelectedId(draft?.id ?? null);
      const payload = asPayload(draft?.payloadJson);
      setForm(payload);
      setPayloadText(JSON.stringify(payload, null, 2));
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't load this information.");
    } finally {
      setLoading(false);
    }
  }, [tenantId, canUpdate]);

  useEffect(() => {
    void load();
  }, [load]);

  // Only rehydrate the form when the user switches version — never when versions[] is
  // refreshed after an upload, or the new logoUrl gets wiped before Save.
  useEffect(() => {
    if (!selectedId) return;
    const row = versions.find((v) => v.id === selectedId);
    if (!row) return;
    const payload = asPayload(row.payloadJson);
    setForm(payload);
    setPayloadText(JSON.stringify(payload, null, 2));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: selectedId only
  }, [selectedId]);

  function updateField<K extends keyof BrandingPayload>(key: K, value: BrandingPayload[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      setPayloadText(JSON.stringify(next, null, 2));
      return next;
    });
  }

  function updateLoginField<K extends keyof LoginBrandingPayload>(
    key: K,
    value: LoginBrandingPayload[K],
  ) {
    setForm((prev) => {
      const login = { ...(prev.login ?? EMPTY_LOGIN), [key]: value };
      const next: BrandingPayload = {
        ...prev,
        login,
        ...(key === "brandLabel" && typeof value === "string"
          ? { loginShortName: value }
          : {}),
      };
      setPayloadText(JSON.stringify(next, null, 2));
      return next;
    });
  }

  function currentPayload(fromForm: BrandingPayload = form): BrandingPayload {
    return payloadFromForm(fromForm, payloadText, showAdvanced);
  }

  async function persistAsset(key: "logoUrl" | "iconUrl" | "login.logoUrl", url: string) {
    const nextForm: BrandingPayload =
      key === "login.logoUrl"
        ? { ...form, login: { ...(form.login ?? EMPTY_LOGIN), logoUrl: url } }
        : { ...form, [key]: url };
    setForm(nextForm);
    setPayloadText(JSON.stringify(nextForm, null, 2));
    if (!tenantId || !object || !selected || selected.state !== "DRAFT") return;
    try {
      const payload = currentPayload(nextForm);
      await apiSend(
        `/api/v1/tenants/${tenantId}/config/branding/${object.objectKey}/versions/${selected.id}`,
        "PATCH",        { payload, changeSummary: key === "logoUrl" ? "Upload logo" : "Upload icon" },
      );
      setVersions((prev) =>
        prev.map((row) => (row.id === selected.id ? { ...row, payloadJson: payload } : row)),
      );
      setMessage(key === "logoUrl" ? "Logo saved to draft" : "Icon saved to draft");
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save uploaded asset to draft");
    }
  }

  async function saveDraft() {
    if (!tenantId || !object || !selected || !draftSelected) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const payload = currentPayload();
      await apiSend(
        `/api/v1/tenants/${tenantId}/config/branding/${object.objectKey}/versions/${selected.id}`,
        "PATCH",
        { payload, changeSummary: changeSummary || undefined },
      );
      setMessage("Draft saved");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function createDraft() {
    if (!tenantId) return;
    setBusy(true);
    setError(null);
    try {
      const payload = currentPayload();
      await apiSend(`/api/v1/tenants/${tenantId}/config/branding`, "POST", {
        objectKey: "default",
        displayName: "Branding",
        payload,
        changeSummary: changeSummary || "New branding draft",
      });
      setMessage("Draft created");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create draft failed");
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    if (!tenantId || !object || !selectedId) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (draftSelected) {
        const payload = currentPayload();
        await apiSend(
          `/api/v1/tenants/${tenantId}/config/branding/${object.objectKey}/versions/${selectedId}`,
          "PATCH",
          { payload, changeSummary: changeSummary || "Publish branding" },
        );
      }
      await apiSend(
        `/api/v1/tenants/${tenantId}/config/branding/${object.objectKey}/versions/${selectedId}/publish`,
        "POST",
      );
      setMessage("Branding published — Industrial Safety will use it after refresh");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publish failed");
    } finally {
      setBusy(false);
    }
  }

  if (!tenantId) {
    return (
      <CreatorPage title="Branding">
        <TenantRequired />
      </CreatorPage>
    );
  }

  return (
    <CreatorPage
      title="Branding"
      subtitle={
        <>
          <Link href={tenantDetailHref(tenantId)}>Back to Customer</Link>
          {" · "}
          Edit logos and product wording for this tenant, then publish. Apps load the published
          version automatically.{" "}
          <Link href={`/studio${tenantQuery(tenantId)}`}>Studio home</Link>
        </>
      }
    >

      {!canUpdate ? <p className={styles.error}>Missing configuration update permission</p> : null}
      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}
      {message ? <p className={styles.success}>{message}</p> : null}
      {loading ? <p className={styles.muted}>Loading…</p> : null}

      <ForgePageSection title="Preview">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            padding: "0.85rem 1rem",
            borderRadius: "0.5rem",
            background: form.secondaryColor || "#14201a",
            color: "#fff",
            maxWidth: "28rem",
            minHeight: "3.5rem",
          }}
        >
          {form.logoUrl ? (
            <img
              src={form.logoUrl}
              alt={form.appShortName || "Logo"}
              style={{
                height: 40,
                width: "auto",
                maxWidth: 200,
                objectFit: "contain",
                background: "#fff",
                borderRadius: 6,
                padding: "4px 8px",
              }}
            />
          ) : (
            <>
              <span
                aria-hidden
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 6,
                  background: form.primaryColor || "#696cff",
                  display: "inline-block",
                  flexShrink: 0,
                }}
              />
              <div>
                <div style={{ fontWeight: 700 }}>{form.appShortName || "Bridge"}</div>
                <div style={{ fontSize: "0.85rem", opacity: 0.85 }}>
                  {form.productDisplayName || "Forge Industrial Safety"}
                </div>
              </div>
            </>
          )}
        </div>
      </ForgePageSection>

      <ForgePageSection title="Login screen">
        <p className={styles.muted} style={{ marginBottom: "1rem" }}>
          Copy and lockup for the Sign-in gate before authentication.
        </p>
        <div
          style={{
            maxWidth: "24rem",
            marginBottom: "1.25rem",
            padding: "1.25rem 1.35rem",
            borderRadius: "0.5rem",
            border: "1px solid #d9dee3",
            background: "#fff",
            boxShadow: "0 1px 4px rgba(67, 89, 113, 0.08)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: "0.5rem",
              marginBottom: "1rem",
              minHeight: 40,
            }}
          >
            {(form.login?.logoUrl || form.logoUrl) ? (
              <img
                src={form.login?.logoUrl || form.logoUrl}
                alt={form.login?.brandLabel || "Login logo"}
                style={{
                  height: 40,
                  width: "auto",
                  maxWidth: 220,
                  objectFit: "contain",
                }}
              />
            ) : (
              <>
                <span
                  aria-hidden
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 6,
                    background: form.primaryColor || "#696cff",
                    display: "inline-block",
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontWeight: 700 }}>
                  {form.login?.brandLabel || form.loginShortName || "Industrial"}
                </span>
              </>
            )}
          </div>
          <h3 style={{ margin: "0 0 0.5rem", fontSize: "1.15rem", fontWeight: 600 }}>
            {form.login?.headline ||
              `Welcome to ${form.productDisplayName || "Forge Industrial Safety"}`}
          </h3>
          <p style={{ margin: "0 0 0.75rem", color: "#566a7f" }}>
            {form.login?.body || "Sign in is required to continue."}
          </p>
          <p style={{ margin: "0 0 1rem", color: "#a1acb8", fontSize: "0.9rem" }}>
            {form.login?.statusText || "Unauthenticated"}
          </p>
          <button
            type="button"
            disabled
            style={{
              width: "100%",
              padding: "0.55rem 1rem",
              border: "none",
              borderRadius: "0.375rem",
              background: form.primaryColor || "#696cff",
              color: "#fff",
              fontWeight: 600,
              cursor: "default",
            }}
          >
            {form.login?.buttonLabel || "Sign in"}
          </button>
        </div>
        <div className={styles.form}>
          <ImageUpload
            tenantId={tenantId}
            label="Login logo"
            value={form.login?.logoUrl ?? ""}
            disabled={!draftSelected && Boolean(selected)}
            helpText="Optional. When empty, the gate uses the sidebar logo, then mark + brand label."
            onChange={(url) => void persistAsset("login.logoUrl", url)}
          />
          <div className={styles.formRow}>
            <label htmlFor="login-brand-label">Brand label</label>
            <input
              id="login-brand-label"
              value={form.login?.brandLabel ?? ""}
              onChange={(e) => updateLoginField("brandLabel", e.target.value)}
              placeholder="Industrial"
              disabled={!draftSelected && Boolean(selected)}
            />
            <span className={styles.muted}>Shown next to the mark when no login/sidebar logo.</span>
          </div>
          <div className={styles.formRow}>
            <label htmlFor="login-headline">Headline</label>
            <input
              id="login-headline"
              value={form.login?.headline ?? ""}
              onChange={(e) => updateLoginField("headline", e.target.value)}
              placeholder="Welcome to Forge Industrial Safety"
              disabled={!draftSelected && Boolean(selected)}
            />
          </div>
          <div className={styles.formRow}>
            <label htmlFor="login-body">Body</label>
            <input
              id="login-body"
              value={form.login?.body ?? ""}
              onChange={(e) => updateLoginField("body", e.target.value)}
              placeholder="Sign in is required to continue."
              disabled={!draftSelected && Boolean(selected)}
            />
          </div>
          <div className={styles.formRow}>
            <label htmlFor="login-status">Status text</label>
            <input
              id="login-status"
              value={form.login?.statusText ?? ""}
              onChange={(e) => updateLoginField("statusText", e.target.value)}
              placeholder="Unauthenticated"
              disabled={!draftSelected && Boolean(selected)}
            />
          </div>
          <div className={styles.formRow}>
            <label htmlFor="login-button">Button label</label>
            <input
              id="login-button"
              value={form.login?.buttonLabel ?? ""}
              onChange={(e) => updateLoginField("buttonLabel", e.target.value)}
              placeholder="Sign in"
              disabled={!draftSelected && Boolean(selected)}
            />
          </div>
        </div>
      </ForgePageSection>

      <div className={styles.panel}>
        <h2>
          Brand details{" "}
          {selected ? (
            <span className={styles.muted}>
              (v{selected.version} · {selected.state})
            </span>
          ) : null}
        </h2>
        <div className={styles.form}>
          <div className={styles.formRow}>
            <label htmlFor="product-display-name">Product display name</label>
            <input
              id="product-display-name"
              value={form.productDisplayName ?? ""}
              onChange={(e) => updateField("productDisplayName", e.target.value)}
              placeholder="Forge Industrial Safety"
              disabled={!draftSelected && Boolean(selected)}
            />
            <span className={styles.muted}>Shown in headers, gates, and dashboard title.</span>
          </div>
          <div className={styles.formRow}>
            <label htmlFor="app-short-name">Sidebar short name</label>
            <input
              id="app-short-name"
              value={form.appShortName ?? ""}
              onChange={(e) => updateField("appShortName", e.target.value)}
              placeholder="Bridge"
              disabled={!draftSelected && Boolean(selected)}
            />
          </div>
          <ImageUpload
            tenantId={tenantId}
            label="Logo"
            value={form.logoUrl ?? ""}
            disabled={!draftSelected && Boolean(selected)}
            helpText="Full logo for the sidebar (replaces mark + short name). PNG, JPEG, WebP, GIF, or SVG up to 2 MB. Saved to the draft as soon as upload finishes — then publish. Use Login screen for the Sign-in card logo."
            onChange={(url) => void persistAsset("logoUrl", url)}
          />
          <ImageUpload
            tenantId={tenantId}
            label="App icon / favicon"
            value={form.iconUrl ?? ""}
            disabled={!draftSelected && Boolean(selected)}
            helpText="Square icon for collapsed menu / favicon contexts."
            onChange={(url) => void persistAsset("iconUrl", url)}
          />
          <div className={styles.formRow}>
            <label htmlFor="primary-color">Primary color</label>
            <input
              id="primary-color"
              type="color"
              value={form.primaryColor && /^#/.test(form.primaryColor) ? form.primaryColor : "#696cff"}
              onChange={(e) => updateField("primaryColor", e.target.value)}
              disabled={!draftSelected && Boolean(selected)}
            />
          </div>
          <div className={styles.formRow}>
            <label htmlFor="secondary-color">Secondary / shell color</label>
            <input
              id="secondary-color"
              type="color"
              value={
                form.secondaryColor && /^#/.test(form.secondaryColor)
                  ? form.secondaryColor
                  : "#14201a"
              }
              onChange={(e) => updateField("secondaryColor", e.target.value)}
              disabled={!draftSelected && Boolean(selected)}
            />
          </div>
          <div className={styles.formRow}>
            <label htmlFor="accent-color">Accent color</label>
            <input
              id="accent-color"
              type="color"
              value={form.accentColor && /^#/.test(form.accentColor) ? form.accentColor : "#696cff"}
              onChange={(e) => updateField("accentColor", e.target.value)}
              disabled={!draftSelected && Boolean(selected)}
            />
          </div>
          <div className={styles.formRow}>
            <label htmlFor="email-from-name">Email from name</label>
            <input
              id="email-from-name"
              value={form.emailFromName ?? ""}
              onChange={(e) => updateField("emailFromName", e.target.value)}
              disabled={!draftSelected && Boolean(selected)}
            />
          </div>
          <div className={styles.formRow}>
            <label htmlFor="email-from-address">Email from address</label>
            <input
              id="email-from-address"
              type="email"
              value={form.emailFromAddress ?? ""}
              onChange={(e) => updateField("emailFromAddress", e.target.value)}
              disabled={!draftSelected && Boolean(selected)}
            />
          </div>
          <div className={styles.formRow}>
            <label htmlFor="change-summary">Change summary</label>
            <input
              id="change-summary"
              value={changeSummary}
              onChange={(e) => setChangeSummary(e.target.value)}
              placeholder="Why this change?"
            />
          </div>
        </div>

        <div className={styles.actions}>
          {canUpdate ? (
            <>
              <button
                type="button"
                className={styles.button}
                disabled={busy}
                onClick={() => void createDraft()}
              >
                New draft
              </button>
              <button
                type="button"
                className={styles.buttonSecondary}
                disabled={busy || !draftSelected}
                onClick={() => void saveDraft()}
              >
                Save draft
              </button>
            </>
          ) : null}
          {canPublish ? (
            <button
              type="button"
              className={styles.button}
              disabled={busy || !selectedId}
              onClick={() => void publish()}
            >
              Save &amp; publish
            </button>
          ) : null}
        </div>

        <p className={styles.muted} style={{ marginTop: "1rem" }}>
          <button
            type="button"
            className={styles.buttonSecondary}
            onClick={() => setShowAdvanced((v) => !v)}
          >
            {showAdvanced ? "Hide advanced JSON" : "Show advanced JSON"}
          </button>
        </p>
        {showAdvanced ? (
          <div className={styles.formRow}>
            <label htmlFor="payload-json">Payload JSON</label>
            <textarea
              id="payload-json"
              rows={14}
              value={payloadText}
              onChange={(e) => setPayloadText(e.target.value)}
              spellCheck={false}
              style={{ fontFamily: "ui-monospace, monospace", minHeight: "12rem" }}
              disabled={!draftSelected && Boolean(selected)}
            />
          </div>
        ) : null}
      </div>

      <ForgePageSection title="Version history">
        {versions.length === 0 ? (
          <p className={styles.muted}>No versions yet.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Ver</th>
                <th>State</th>
                <th>Summary</th>
                <th>Created</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {versions.map((row) => (
                <tr key={row.id}>
                  <td>v{row.version}</td>
                  <td><ForgeStatusBadge status={row.state} /></td>
                  <td>{row.changeSummary ?? "—"}</td>
                  <td>{new Date(row.createdAt).toLocaleString()}</td>
                  <td>
                    <button
                      type="button"
                      className={styles.buttonSecondary}
                      onClick={() => setSelectedId(row.id)}
                    >
                      Select
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </ForgePageSection>
    </CreatorPage>
  );
}

export function BrandingStudioPage() {
  return (
    <Suspense
      fallback={<CreatorLoading />}
    >
      <BrandingStudioInner />
    </Suspense>
  );
}
