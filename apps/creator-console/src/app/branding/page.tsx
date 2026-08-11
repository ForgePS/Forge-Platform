"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState, type FormEvent } from "react";
import { PlatformPageGate } from "@/components/platform-page-gate";
import { TenantRequired } from "@/components/tenant-required";
import { useAuth } from "@/hooks/use-auth";
import { tenantQuery, useTenantId } from "@/hooks/use-tenant-id";
import { apiGet, apiSend } from "@/lib/api";
import styles from "../page.module.css";

type Branding = {
  id: string;
  displayName: string | null;
  shortName: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  accentColor: string | null;
  approvedColorsJson: string[] | null;
  contactName: string | null;
  reportIdentity: string | null;
  documentFooter: string | null;
  emailSenderName: string | null;
  supportEmail: string | null;
  customCssEnabled: boolean;
  logoDocumentId: string | null;
  iconDocumentId: string | null;
  recordVersion?: number;
};

function BrandingInner() {
  const tenantId = useTenantId();
  const { hasPermission } = useAuth();
  const canRead =
    hasPermission("platform.configuration.update") ||
    hasPermission("tenant.configuration.update");
  const canManage = canRead;

  const [branding, setBranding] = useState<Branding | null>(null);
  const [loading, setLoading] = useState(Boolean(tenantId));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [shortName, setShortName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("");
  const [secondaryColor, setSecondaryColor] = useState("");
  const [accentColor, setAccentColor] = useState("");
  const [approvedColors, setApprovedColors] = useState("");
  const [contactName, setContactName] = useState("");
  const [emailSenderName, setEmailSenderName] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [reportIdentity, setReportIdentity] = useState("");
  const [documentFooter, setDocumentFooter] = useState("");

  const load = useCallback(async () => {
    if (!tenantId || !canRead) return;
    setLoading(true);
    setError(null);
    try {
      const row = await apiGet<Branding | null>(`/api/v1/tenants/${tenantId}/branding`);
      setBranding(row);
      setDisplayName(row?.displayName ?? "");
      setShortName(row?.shortName ?? "");
      setPrimaryColor(row?.primaryColor ?? "");
      setSecondaryColor(row?.secondaryColor ?? "");
      setAccentColor(row?.accentColor ?? "");
      setApprovedColors((row?.approvedColorsJson ?? []).join(", "));
      setContactName(row?.contactName ?? "");
      setEmailSenderName(row?.emailSenderName ?? "");
      setSupportEmail(row?.supportEmail ?? "");
      setReportIdentity(row?.reportIdentity ?? "");
      setDocumentFooter(row?.documentFooter ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load branding");
    } finally {
      setLoading(false);
    }
  }, [tenantId, canRead]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSave(event: FormEvent) {
    event.preventDefault();
    if (!tenantId || !canManage) return;
    setSubmitting(true);
    setError(null);
    try {
      const updated = await apiSend<Branding>(
        `/api/v1/tenants/${tenantId}/branding`,
        "PUT",
        {
          displayName: displayName.trim() || null,
          shortName: shortName.trim() || null,
          primaryColor: primaryColor.trim() || null,
          secondaryColor: secondaryColor.trim() || null,
          accentColor: accentColor.trim() || null,
          approvedColorsJson: approvedColors
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean),
          contactName: contactName.trim() || null,
          emailSenderName: emailSenderName.trim() || null,
          supportEmail: supportEmail.trim() || null,
          reportIdentity: reportIdentity.trim() || null,
          documentFooter: documentFooter.trim() || null,
        },
        { idempotencyKey: crypto.randomUUID() },
      );
      setBranding(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save branding");
    } finally {
      setSubmitting(false);
    }
  }

  if (!tenantId) {
    return (
      <section className={styles.page}>
        <h1>Branding</h1>
        <TenantRequired />
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <h1>Branding</h1>
      <p className={styles.lead}>
        Tenant <span className={styles.mono}>{tenantId}</span> ·{" "}
        <Link href={`/configuration${tenantQuery(tenantId)}`}>Configuration</Link> ·{" "}
        <Link href={`/audit${tenantQuery(tenantId)}`}>Audit history</Link>
      </p>

      {error ? <p className={styles.error}>{error}</p> : null}
      {loading ? <p className={styles.muted}>Loading…</p> : null}

      {branding ? (
        <p className={styles.muted}>
          Logo <span className={styles.mono}>{branding.logoDocumentId ?? "—"}</span> · Icon{" "}
          <span className={styles.mono}>{branding.iconDocumentId ?? "—"}</span>
        </p>
      ) : null}

      {canRead ? (
        <div className={styles.panel}>
          <h2>Branding settings</h2>
          <form className={styles.form} onSubmit={onSave}>
            <div className={styles.formRow}>
              <label htmlFor="displayName">Name</label>
              <input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </div>
            <div className={styles.formRow}>
              <label htmlFor="shortName">Short name</label>
              <input id="shortName" value={shortName} onChange={(e) => setShortName(e.target.value)} />
            </div>
            <div className={styles.formRow}>
              <label htmlFor="primaryColor">Primary color</label>
              <input
                id="primaryColor"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                placeholder="#14532d"
              />
            </div>
            <div className={styles.formRow}>
              <label htmlFor="secondaryColor">Secondary color</label>
              <input
                id="secondaryColor"
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
              />
            </div>
            <div className={styles.formRow}>
              <label htmlFor="accentColor">Accent color</label>
              <input id="accentColor" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} />
            </div>
            <div className={styles.formRow}>
              <label htmlFor="approvedColors">Approved colors</label>
              <input
                id="approvedColors"
                value={approvedColors}
                onChange={(e) => setApprovedColors(e.target.value)}
                placeholder="#14532d, #166534"
              />
            </div>
            <div className={styles.formRow}>
              <label htmlFor="contactName">Contact</label>
              <input id="contactName" value={contactName} onChange={(e) => setContactName(e.target.value)} />
            </div>
            <div className={styles.formRow}>
              <label htmlFor="emailSenderName">Email sender name</label>
              <input
                id="emailSenderName"
                value={emailSenderName}
                onChange={(e) => setEmailSenderName(e.target.value)}
              />
            </div>
            <div className={styles.formRow}>
              <label htmlFor="supportEmail">Support email</label>
              <input
                id="supportEmail"
                type="email"
                value={supportEmail}
                onChange={(e) => setSupportEmail(e.target.value)}
              />
            </div>
            <div className={styles.formRow}>
              <label htmlFor="reportIdentity">Report identity</label>
              <input
                id="reportIdentity"
                value={reportIdentity}
                onChange={(e) => setReportIdentity(e.target.value)}
              />
            </div>
            <div className={styles.formRow}>
              <label htmlFor="documentFooter">Document footer</label>
              <textarea
                id="documentFooter"
                value={documentFooter}
                onChange={(e) => setDocumentFooter(e.target.value)}
                rows={3}
              />
            </div>
            <div className={styles.actions}>
              <button className={styles.button} type="submit" disabled={submitting || !canManage}>
                {submitting ? "Saving…" : canManage ? "Save branding" : "Read only"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}

export default function BrandingPage() {
  return (
    <PlatformPageGate
      title="Branding"
      anyOf={["platform.configuration.update", "tenant.configuration.update"]}
    >
      <Suspense fallback={<p className={styles.muted}>Loading…</p>}>
        <BrandingInner />
      </Suspense>
    </PlatformPageGate>
  );
}
