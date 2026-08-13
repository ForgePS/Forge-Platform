"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { INDUSTRIAL_PRODUCT_CODE } from "@forge/contracts";
import { ForgePageSection } from "@forge/ui";
import { CreatorLoading, CreatorPage } from "@/components/creator-page";
import { tenantDetailHref } from "@/hooks/use-tenant-id";
import { apiGet } from "@/lib/api";
import { getSupportSession } from "@/lib/support-session";
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

type EntitlementSnapshot = {
  products?: Array<{ productCode: string; status?: string }>;
};

const INDUSTRIAL_APP_URL =
  process.env.NEXT_PUBLIC_INDUSTRIAL_APP_URL?.replace(/\/$/, "") ??
  "https://industrial-dev.forgepublicsafety.com";

function isIndustrialEntitled(products: EntitlementSnapshot["products"]): boolean {
  return (products ?? []).some(
    (p) =>
      p.productCode === INDUSTRIAL_PRODUCT_CODE &&
      (!p.status || p.status === "ACTIVE" || p.status === "ENTITLED"),
  );
}

function SupportInner() {
  const searchParams = useSearchParams();
  const sessionStarted = searchParams.get("session") === "started";

  const [query, setQuery] = useState("");
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [industrialById, setIndustrialById] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSessionName, setActiveSessionName] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await apiGet<Tenant[]>("/api/v1/platform/tenants");
      setTenants(rows);
      const entitlementEntries = await Promise.all(
        rows.slice(0, 40).map(async (t) => {
          try {
            const ents = await apiGet<EntitlementSnapshot>(
              `/api/v1/tenants/${t.id}/entitlements`,
            );
            return [t.id, isIndustrialEntitled(ents.products)] as const;
          } catch {
            return [t.id, false] as const;
          }
        }),
      );
      setIndustrialById(Object.fromEntries(entitlementEntries));
    } catch {
      setError("We couldn't load customers right now. Try again in a moment.");
      setTenants([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    setActiveSessionName(getSupportSession()?.customerName ?? null);
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tenants;
    return tenants.filter(
      (t) =>
        t.displayName.toLowerCase().includes(q) ||
        t.legalName.toLowerCase().includes(q) ||
        t.slug.toLowerCase().includes(q) ||
        t.tenantKey.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q),
    );
  }, [tenants, query]);

  return (
    <CreatorPage
      width="wide"
      title="Support"
      subtitle="Find a customer and open their workspace, application, or a guided support session."
      actions={
        <Link className="forge-btn" href="/support/session">
          Start Support Session
        </Link>
      }
    >
      {sessionStarted || activeSessionName ? (
        <p className={styles.success}>
          Support session active
          {activeSessionName ? ` · Viewing ${activeSessionName}` : ""}. Use End Session in the
          banner when finished.
        </p>
      ) : null}

      <ForgePageSection title="Customer search">
        <div className={styles.form}>
          <div className={styles.formRow}>
            <label htmlFor="support-search">Search customers</label>
            <input
              id="support-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name, slug, or key"
            />
          </div>
        </div>

        {loading ? <p className={styles.muted}>Loading customers…</p> : null}
        {error ? <p className={styles.error}>{error}</p> : null}

        {!loading && !error && filtered.length === 0 ? (
          <p className={styles.muted}>
            {query.trim()
              ? "No customers match that search."
              : "No customers are available yet."}
          </p>
        ) : null}

        {!loading && filtered.length > 0 ? (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Status</th>
                <th>Key</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id}>
                  <td>
                    <div>{t.displayName}</div>
                    <div className={styles.muted}>{t.legalName}</div>
                  </td>
                  <td>{t.status}</td>
                  <td className={styles.mono}>{t.tenantKey}</td>
                  <td>
                    <div className={styles.actions}>
                      <Link
                        className="forge-btn forge-btn--secondary"
                        href={tenantDetailHref(t.id)}
                      >
                        Open Customer
                      </Link>
                      {industrialById[t.id] ? (
                        <a
                          className="forge-btn forge-btn--outline"
                          href={`${INDUSTRIAL_APP_URL}/`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open Application
                        </a>
                      ) : null}
                      <Link
                        className="forge-btn"
                        href={`/support/session?customerId=${encodeURIComponent(t.id)}`}
                      >
                        Start Support Session
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </ForgePageSection>
    </CreatorPage>
  );
}

export default function SupportPage() {
  return (
    <Suspense fallback={<CreatorLoading label="Loading support…" />}>
      <SupportInner />
    </Suspense>
  );
}
