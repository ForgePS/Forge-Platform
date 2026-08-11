"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState, type FormEvent } from "react";
import { TenantPageGate } from "@/components/tenant-page-gate";
import { TenantRequired } from "@/components/tenant-required";
import { useAuth } from "@/hooks/use-auth";
import { tenantQuery, useTenantId } from "@/hooks/use-tenant-id";
import { apiGet, apiSend } from "@/lib/api";
import styles from "../page.module.css";

type Branding = {
  primaryColor: string | null;
  secondaryColor: string | null;
  accentColor: string | null;
  supportEmail: string | null;
  emailSenderName: string | null;
};

function BrandingInner() {
  const tenantId = useTenantId();
  const { hasPermission } = useAuth();
  const canApi = hasPermission("platform.configuration.update");
  const [branding, setBranding] = useState<Branding | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [primaryColor, setPrimaryColor] = useState("");
  const [supportEmail, setSupportEmail] = useState("");

  const load = useCallback(async () => {
    if (!tenantId || !canApi) return;
    setLoading(true);
    setError(null);
    try {
      const row = await apiGet<Branding | null>(`/api/v1/tenants/${tenantId}/branding`);
      setBranding(row);
      setPrimaryColor(row?.primaryColor ?? "");
      setSupportEmail(row?.supportEmail ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load branding API");
    } finally {
      setLoading(false);
    }
  }, [tenantId, canApi]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSave(event: FormEvent) {
    event.preventDefault();
    if (!tenantId || !canApi) return;
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      await apiSend(`/api/v1/tenants/${tenantId}/branding`, "PUT", {
        primaryColor: primaryColor || null,
        supportEmail: supportEmail || null,
      });
      setMessage("Branding saved (audited).");
      await load();
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

  const q = tenantQuery(tenantId);

  return (
    <section className={styles.page}>
      <h1>Branding</h1>
      <p className={styles.lead}>
        Tenant brand settings. Prefer Studio when you lack platform.configuration.update.
      </p>
      {error ? <p className={styles.error}>{error}</p> : null}
      {message ? <p className={styles.success}>{message}</p> : null}
      {loading ? <p className={styles.muted}>Loading…</p> : null}

      {canApi ? (
        <div className={styles.panel}>
          <h2>Branding API</h2>
          {branding ? (
            <dl className={styles.dl}>
              <dt>Primary</dt>
              <dd className={styles.mono}>{branding.primaryColor ?? "—"}</dd>
              <dt>Secondary</dt>
              <dd className={styles.mono}>{branding.secondaryColor ?? "—"}</dd>
              <dt>Accent</dt>
              <dd className={styles.mono}>{branding.accentColor ?? "—"}</dd>
            </dl>
          ) : (
            <p className={styles.muted}>No branding row yet.</p>
          )}
          <form className={styles.form} onSubmit={onSave} style={{ marginTop: "1rem" }}>
            <div className={styles.formRow}>
              <label htmlFor="primaryColor">Primary color</label>
              <input
                id="primaryColor"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                placeholder="#0d6efd"
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
            <div className={styles.actions}>
              <button className={styles.button} type="submit" disabled={submitting}>
                {submitting ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className={styles.panel}>
          <p className={styles.muted}>
            Branding API mutations require platform.configuration.update. Use Configuration Studio
            for delegated tenant branding.
          </p>
        </div>
      )}

      <nav className={styles.linkRow}>
        <Link href={`/studio/branding${q}`}>Studio · Branding</Link>
      </nav>
    </section>
  );
}

export default function BrandingPage() {
  return (
    <TenantPageGate
      title="Branding"
      anyOf={["tenant.configuration.update", "platform.configuration.update"]}
    >
      <Suspense fallback={<p className={styles.muted}>Loading…</p>}>
        <BrandingInner />
      </Suspense>
    </TenantPageGate>
  );
}
