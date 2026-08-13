"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState, type FormEvent } from "react";
import {
  CreatorLoading,
  CreatorPage,
  ErrorState,
  ForgePageSection,
} from "@/components/creator-page";
import { tenantDetailHref, useTenantId } from "@/hooks/use-tenant-id";
import { TenantRequired } from "@/components/tenant-required";
import { apiGet, apiSend } from "@/lib/api";
import styles from "../page.module.css";

type EffectiveFeature = {
  key: string;
  name: string;
  value: unknown;
  valueType: string;
};

function FeaturesInner() {
  const tenantId = useTenantId();

  const [features, setFeatures] = useState<EffectiveFeature[]>([]);
  const [loading, setLoading] = useState(Boolean(tenantId));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [featureKey, setFeatureKey] = useState("");
  const [valueText, setValueText] = useState("true");
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const rows = await apiGet<EffectiveFeature[]>(
        `/api/v1/tenants/${tenantId}/features/effective`,
      );
      setFeatures(rows);
      setFeatureKey((current) => current || rows[0]?.key || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't load this information.");
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onOverride(event: FormEvent) {
    event.preventDefault();
    if (!tenantId || !featureKey) return;
    setSubmitting(true);
    setError(null);
    try {
      let value: unknown = valueText;
      try {
        value = JSON.parse(valueText) as unknown;
      } catch {
        // treat as plain string
      }
      await apiSend(`/api/v1/tenants/${tenantId}/features/${featureKey}`, "PUT", {
        value,
        ...(reason.trim() ? { reason: reason.trim() } : {}),
      });
      setReason("");
      const rows = await apiGet<EffectiveFeature[]>(
        `/api/v1/tenants/${tenantId}/features/effective`,
      );
      setFeatures(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to put feature override");
    } finally {
      setSubmitting(false);
    }
  }

  if (!tenantId) {
    return (
      <CreatorPage title="Features">
        <TenantRequired />
      </CreatorPage>
    );
  }

  return (
    <CreatorPage
      title="Features"
      subtitle={<Link href={tenantDetailHref(tenantId)}>Back to Customer</Link>}
    >
      {error ? (
        error.toLowerCase().includes("override") || error.toLowerCase().includes("put") ? (
          <p className={styles.error}>{error}</p>
        ) : (
          <ErrorState title="We couldn't load this information." description={error} />
        )
      ) : null}

      <ForgePageSection title="Put tenant override">
        <form className={styles.form} onSubmit={onOverride}>
          <div className={styles.formRow}>
            <label htmlFor="featureKey">Feature key</label>
            <select
              id="featureKey"
              value={featureKey}
              onChange={(e) => setFeatureKey(e.target.value)}
              required
            >
              {features.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.key} — {f.name}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.formRow}>
            <label htmlFor="valueText">Value (JSON or string)</label>
            <input
              id="valueText"
              required
              value={valueText}
              onChange={(e) => setValueText(e.target.value)}
            />
          </div>
          <div className={styles.formRow}>
            <label htmlFor="reason">Reason (optional)</label>
            <input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <div className={styles.actions}>
            <button className={styles.button} type="submit" disabled={submitting}>
              {submitting ? "Saving…" : "Put override"}
            </button>
          </div>
        </form>
      </ForgePageSection>

      <ForgePageSection title="Effective features" flush>
        {loading ? <p className={styles.muted}>Loading…</p> : null}
        {!loading && features.length === 0 ? (
          <p className={styles.muted}>No feature definitions.</p>
        ) : null}
        {features.length > 0 ? (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Key</th>
                <th>Name</th>
                <th>Type</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {features.map((f) => (
                <tr key={f.key}>
                  <td className={styles.mono}>{f.key}</td>
                  <td>{f.name}</td>
                  <td>{f.valueType}</td>
                  <td className={styles.mono}>{JSON.stringify(f.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </ForgePageSection>
    </CreatorPage>
  );
}

export default function FeaturesPage() {
  return (
    <Suspense fallback={<CreatorLoading />}>
      <FeaturesInner />
    </Suspense>
  );
}
