"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { tenantDetailHref } from "@/hooks/use-tenant-id";
import { apiGet, apiSend } from "@/lib/api";
import styles from "../page.module.css";

type Tenant = {
  id: string;
  tenantKey: string;
  slug: string;
  displayName: string;
  legalName: string;
  status: string;
  tenantType: string;
};

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [tenantKey, setTenantKey] = useState("");
  const [slug, setSlug] = useState("");
  const [legalName, setLegalName] = useState("");
  const [displayName, setDisplayName] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTenants(await apiGet<Tenant[]>("/api/v1/platform/tenants"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tenants");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiSend<Tenant>("/api/v1/platform/tenants", "POST", {
        tenantKey,
        slug,
        legalName,
        displayName,
      });
      setTenantKey("");
      setSlug("");
      setLegalName("");
      setDisplayName("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create tenant");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className={styles.page}>
      <h1>Tenants</h1>
      <p className={styles.lead}>Platform tenants and lifecycle.</p>

      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={styles.panel}>
        <h2>Create tenant</h2>
        <form className={styles.form} onSubmit={onCreate}>
          <div className={styles.formRow}>
            <label htmlFor="tenantKey">Tenant key</label>
            <input
              id="tenantKey"
              required
              value={tenantKey}
              onChange={(e) => setTenantKey(e.target.value)}
              placeholder="acme-fire"
              pattern="[a-z0-9][a-z0-9_-]*"
            />
          </div>
          <div className={styles.formRow}>
            <label htmlFor="slug">Slug</label>
            <input
              id="slug"
              required
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="acme-fire"
              pattern="[a-z0-9][a-z0-9-]*"
            />
          </div>
          <div className={styles.formRow}>
            <label htmlFor="legalName">Legal name</label>
            <input
              id="legalName"
              required
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
            />
          </div>
          <div className={styles.formRow}>
            <label htmlFor="displayName">Display name</label>
            <input
              id="displayName"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>
          <div className={styles.actions}>
            <button className={styles.button} type="submit" disabled={submitting}>
              {submitting ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      </div>

      <div className={styles.panel}>
        <h2>All tenants</h2>
        {loading ? <p className={styles.muted}>Loading…</p> : null}
        {!loading && tenants.length === 0 ? (
          <p className={styles.muted}>No tenants yet.</p>
        ) : null}
        {tenants.length > 0 ? (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Display name</th>
                <th>Key</th>
                <th>Status</th>
                <th>Type</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((tenant) => (
                <tr key={tenant.id}>
                  <td>
                    <Link href={tenantDetailHref(tenant.id)}>{tenant.displayName}</Link>
                  </td>
                  <td className={styles.mono}>{tenant.tenantKey}</td>
                  <td>{tenant.status}</td>
                  <td>{tenant.tenantType}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>
    </section>
  );
}
