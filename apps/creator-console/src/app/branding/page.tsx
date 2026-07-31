"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState, type FormEvent } from "react";
import { TenantRequired } from "@/components/tenant-required";
import { useAuth } from "@/hooks/use-auth";
import { tenantQuery, useTenantId } from "@/hooks/use-tenant-id";
import { apiGet, apiSend } from "@/lib/api";
import styles from "../page.module.css";

type Branding = {
  id: string;
  primaryColor: string | null;
  secondaryColor: string | null;
  accentColor: string | null;
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
  const canRead = hasPermission("platform.configuration.update");
  const canManage = hasPermission("platform.configuration.update");

  const [branding, setBranding] = useState<Branding | null>(null);
  const [loading, setLoading] = useState(Boolean(tenantId));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [primaryColor, setPrimaryColor] = useState("");
  const [secondaryColor, setSecondaryColor] = useState("");
  const [accentColor, setAccentColor] = useState("");
  const [emailSenderName, setEmailSenderName] = useState("");
  const [supportEmail, setSupportEmail] = useState("");

  const load = useCallback(async () => {
    if (!tenantId || !canRead) return;
    setLoading(true);
    setError(null);
    try {
      const row = await apiGet<Branding>(`/api/v1/tenants/${tenantId}/branding`);
      setBranding(row);
      setPrimaryColor(row.primaryColor ?? "");
      setSecondaryColor(row.secondaryColor ?? "");
      setAccentColor(row.accentColor ?? "");
      setEmailSenderName(row.emailSenderName ?? "");
      setSupportEmail(row.supportEmail ?? "");
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
      const updated = await apiSend<Branding>(`/api/v1/tenants/${tenantId}/branding`, "PUT", {
        primaryColor: primaryColor.trim() || null,
        secondaryColor: secondaryColor.trim() || null,
        accentColor: accentColor.trim() || null,
        emailSenderName: emailSenderName.trim() || null,
        supportEmail: supportEmail.trim() || null,
      }, { idempotencyKey: crypto.randomUUID() });
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

      {!canRead ? (
        <p className={styles.error}>Missing permission: platform.configuration.update</p>
      ) : null}
      {error ? <p className={styles.error}>{error}</p> : null}
      {loading ? <p className={styles.muted}>Loading…</p> : null}

      {!loading && canRead && !branding ? (
        <p className={styles.muted}>No branding configured yet.</p>
      ) : null}

      {canRead ? (
        <div className={styles.panel}>
          <h2>Branding settings</h2>
          <form className={styles.form} onSubmit={onSave}>
            <div className={styles.formRow}>
              <label htmlFor="primaryColor">Primary color</label>
              <input
                id="primaryColor"
                value={primaryColor}
                onChange={(event) => setPrimaryColor(event.target.value)}
                placeholder="#14532d"
              />
            </div>
            <div className={styles.formRow}>
              <label htmlFor="secondaryColor">Secondary color</label>
              <input
                id="secondaryColor"
                value={secondaryColor}
                onChange={(event) => setSecondaryColor(event.target.value)}
              />
            </div>
            <div className={styles.formRow}>
              <label htmlFor="accentColor">Accent color</label>
              <input
                id="accentColor"
                value={accentColor}
                onChange={(event) => setAccentColor(event.target.value)}
              />
            </div>
            <div className={styles.formRow}>
              <label htmlFor="emailSenderName">Email sender name</label>
              <input
                id="emailSenderName"
                value={emailSenderName}
                onChange={(event) => setEmailSenderName(event.target.value)}
              />
            </div>
            <div className={styles.formRow}>
              <label htmlFor="supportEmail">Support email</label>
              <input
                id="supportEmail"
                type="email"
                value={supportEmail}
                onChange={(event) => setSupportEmail(event.target.value)}
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
    <Suspense fallback={<p className={styles.muted}>Loading…</p>}>
      <BrandingInner />
    </Suspense>
  );
}
