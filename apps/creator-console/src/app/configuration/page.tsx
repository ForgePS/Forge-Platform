"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import {
  CreatorLoading,
  CreatorPage,
  ErrorState,
  ForgePageSection,
} from "@/components/creator-page";
import { tenantDetailHref, useTenantId } from "@/hooks/use-tenant-id";
import { TenantRequired } from "@/components/tenant-required";
import { apiGet } from "@/lib/api";
import styles from "../page.module.css";

type Setting = {
  id: string;
  namespace: string;
  settingKey: string;
  valueJson: unknown;
  isSensitive: boolean;
  schemaVersion: number;
};

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
} | null;

function ConfigurationInner() {
  const tenantId = useTenantId();

  const [settings, setSettings] = useState<Setting[]>([]);
  const [branding, setBranding] = useState<Branding>(null);
  const [loading, setLoading] = useState(Boolean(tenantId));
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const [config, brand] = await Promise.all([
        apiGet<Setting[]>(`/api/v1/tenants/${tenantId}/configuration`),
        apiGet<Branding>(`/api/v1/tenants/${tenantId}/branding`),
      ]);
      setSettings(config);
      setBranding(brand);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't load this information.");
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!tenantId) {
    return (
      <CreatorPage title="Configuration">
        <TenantRequired />
      </CreatorPage>
    );
  }

  return (
    <CreatorPage
      title="Configuration"
      subtitle={<Link href={tenantDetailHref(tenantId)}>Back to Customer</Link>}
    >
      {error ? (
        <ErrorState title="We couldn't load this information." description={error} />
      ) : null}
      {loading ? <p className={styles.muted}>Loading…</p> : null}

      <ForgePageSection title="Branding">
        {!loading && !branding ? <p className={styles.muted}>No branding configured.</p> : null}
        {branding ? (
          <dl className={styles.dl}>
            <dt>Primary</dt>
            <dd>{branding.primaryColor ?? "—"}</dd>
            <dt>Secondary</dt>
            <dd>{branding.secondaryColor ?? "—"}</dd>
            <dt>Accent</dt>
            <dd>{branding.accentColor ?? "—"}</dd>
            <dt>Email sender</dt>
            <dd>{branding.emailSenderName ?? "—"}</dd>
            <dt>Support email</dt>
            <dd>{branding.supportEmail ?? "—"}</dd>
            <dt>Custom CSS</dt>
            <dd>{branding.customCssEnabled ? "enabled" : "disabled"}</dd>
          </dl>
        ) : null}
      </ForgePageSection>

      <ForgePageSection title="Settings" flush>
        {!loading && settings.length === 0 ? (
          <p className={styles.muted}>No configuration settings.</p>
        ) : null}
        {settings.length > 0 ? (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Namespace</th>
                <th>Key</th>
                <th>Value</th>
                <th>Sensitive</th>
              </tr>
            </thead>
            <tbody>
              {settings.map((row) => (
                <tr key={row.id}>
                  <td className={styles.mono}>{row.namespace}</td>
                  <td className={styles.mono}>{row.settingKey}</td>
                  <td className={styles.mono}>
                    {row.isSensitive ? "••••" : JSON.stringify(row.valueJson)}
                  </td>
                  <td>{row.isSensitive ? "yes" : "no"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </ForgePageSection>
    </CreatorPage>
  );
}

export default function ConfigurationPage() {
  return (
    <Suspense fallback={<CreatorLoading />}>
      <ConfigurationInner />
    </Suspense>
  );
}
