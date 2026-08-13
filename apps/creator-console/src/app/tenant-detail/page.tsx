"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { INDUSTRIAL_PRODUCT_CODE } from "@forge/contracts";
import {
  ForgeContextBar,
  ForgePageContainer,
  ForgePageHeader,
  ForgePageSection,
  ForgeStatusBadge,
} from "@forge/ui";
import { apiGetResult, apiSend, toIfMatch } from "@/lib/api";
import styles from "../page.module.css";

type Tenant = {
  id: string;
  tenantKey: string;
  slug: string;
  displayName: string;
  legalName: string;
  status: string;
  tenantType: string;
  timezone: string;
  defaultLocale: string;
  dataRegion: string;
  recordVersion: number;
};

type EntitlementSnapshot = {
  products?: Array<{ productCode: string; status?: string }>;
};

const INDUSTRIAL_APP_URL =
  process.env.NEXT_PUBLIC_INDUSTRIAL_APP_URL?.replace(/\/$/, "") ??
  "https://industrial-dev.forgepublicsafety.com";

function TenantDetailInner() {
  const searchParams = useSearchParams();
  const tenantId = searchParams.get("tenantId");

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [etag, setEtag] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(tenantId));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [suspendReason, setSuspendReason] = useState("");
  const [industrialEntitled, setIndustrialEntitled] = useState(false);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await apiGetResult<Tenant>(`/api/v1/platform/tenants/${tenantId}`);
      setTenant(result.data);
      setEtag(result.etag ?? toIfMatch(result.data.recordVersion));
      try {
        const ents = await apiGetResult<EntitlementSnapshot>(
          `/api/v1/tenants/${tenantId}/entitlements`,
        );
        const products = ents.data.products ?? [];
        setIndustrialEntitled(
          products.some(
            (p) =>
              p.productCode === INDUSTRIAL_PRODUCT_CODE &&
              (!p.status || p.status === "ACTIVE" || p.status === "ENTITLED"),
          ),
        );
      } catch {
        setIndustrialEntitled(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tenant");
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function resolveIfMatch(): Promise<string> {
    if (!tenantId) {
      throw new Error("Missing tenantId");
    }
    const fresh = await apiGetResult<Tenant>(`/api/v1/platform/tenants/${tenantId}`);
    setTenant(fresh.data);
    const next = fresh.etag ?? toIfMatch(fresh.data.recordVersion);
    setEtag(next);
    return next;
  }

  async function activate() {
    if (!tenantId) return;
    setBusy(true);
    setError(null);
    try {
      const ifMatch = await resolveIfMatch();
      const updated = await apiSend<Tenant>(
        `/api/v1/platform/tenants/${tenantId}/activate`,
        "POST",
        undefined,
        { ifMatch },
      );
      setTenant(updated);
      setEtag(toIfMatch(updated.recordVersion));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Activate failed");
    } finally {
      setBusy(false);
    }
  }

  async function suspend() {
    if (!tenantId) return;
    if (!suspendReason.trim()) {
      setError("Suspend requires a reason");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const ifMatch = await resolveIfMatch();
      const updated = await apiSend<Tenant>(
        `/api/v1/platform/tenants/${tenantId}/suspend`,
        "POST",
        { reason: suspendReason },
        { ifMatch },
      );
      setTenant(updated);
      setEtag(toIfMatch(updated.recordVersion));
      setSuspendReason("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Suspend failed");
    } finally {
      setBusy(false);
    }
  }

  if (!tenantId) {
    return (
      <ForgePageContainer>
        <ForgePageHeader title="Customer" subtitle="Missing customer selection." />
        <p className={styles.error}>Open a customer from the Customers list.</p>
        <Link className="forge-btn forge-btn--secondary" href="/tenants">
          Back to Customers
        </Link>
      </ForgePageContainer>
    );
  }

  const q = `?tenantId=${encodeURIComponent(tenantId)}`;

  return (
    <ForgePageContainer>
      <ForgePageHeader
        title={tenant?.displayName ?? "Customer"}
        subtitle="Customer overview, lifecycle actions, and related configuration."
        actions={
          <Link className="forge-btn forge-btn--secondary" href="/tenants">
            Back to Customers
          </Link>
        }
      />

      {error ? <p className={styles.error}>{error}</p> : null}
      {loading ? <p className={styles.muted}>Loading…</p> : null}

      {tenant ? (
        <>
          <ForgeContextBar
            title={tenant.displayName}
            status={<ForgeStatusBadge status={tenant.status} />}
            subtitle={tenant.legalName}
            meta={<span>{tenant.slug}.forgepublicsafety.com</span>}
            actions={
              <>
                {industrialEntitled ? (
                  <a
                    className="forge-btn"
                    href={`${INDUSTRIAL_APP_URL}/`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open Application
                  </a>
                ) : null}
                <Link className="forge-btn forge-btn--outline" href={`/entitlements${q}`}>
                  Products & Modules
                </Link>
              </>
            }
          />

          <ForgePageSection title="Overview">
            <dl className={styles.dl}>
              <dt>Key</dt>
              <dd className={styles.mono}>{tenant.tenantKey}</dd>
              <dt>Slug</dt>
              <dd className={styles.mono}>{tenant.slug}</dd>
              <dt>Type</dt>
              <dd>{tenant.tenantType}</dd>
              <dt>Timezone</dt>
              <dd>{tenant.timezone}</dd>
              <dt>Locale</dt>
              <dd>{tenant.defaultLocale}</dd>
              <dt>Region</dt>
              <dd>{tenant.dataRegion}</dd>
            </dl>

            <details className="forge-advanced-details">
              <summary>Advanced Details</summary>
              <dl className={styles.dl}>
                <dt>Customer ID</dt>
                <dd className={styles.mono}>{tenant.id}</dd>
                {etag ? (
                  <>
                    <dt>Version</dt>
                    <dd className={styles.mono}>{tenant.recordVersion}</dd>
                  </>
                ) : null}
              </dl>
            </details>

            <div className={styles.actions} style={{ marginTop: "1rem" }}>
              <button
                className={styles.button}
                type="button"
                disabled={busy}
                onClick={() => void activate()}
              >
                Activate
              </button>
            </div>

            <div className={styles.form} style={{ marginTop: "1rem" }}>
              <div className={styles.formRow}>
                <label htmlFor="suspendReason">Suspend reason</label>
                <input
                  id="suspendReason"
                  value={suspendReason}
                  onChange={(e) => setSuspendReason(e.target.value)}
                  placeholder="Required to suspend"
                />
              </div>
              <div className={styles.actions}>
                <button
                  className={styles.buttonDanger}
                  type="button"
                  disabled={busy}
                  onClick={() => void suspend()}
                >
                  Suspend
                </button>
              </div>
            </div>
          </ForgePageSection>

          <ForgePageSection title="Related" description="Jump to customer-scoped configuration.">
            <nav className={styles.linkRow}>
              <Link href={`/entitlements${q}`}>Products & Modules</Link>
              <Link href={`/organizations${q}`}>Organizations</Link>
              <Link href={`/persons${q}`}>Persons</Link>
              <Link href={`/users${q}`}>Users</Link>
              <Link href={`/roles${q}`}>Roles</Link>
              <Link href={`/memberships${q}`}>Memberships</Link>
              <Link href={`/invitations${q}`}>Invitations</Link>
              <Link href={`/subscriptions${q}`}>Subscriptions</Link>
              <Link href={`/branding${q}`}>Branding</Link>
              <Link href={`/permissions${q}`}>Permissions</Link>
              <Link href={`/features${q}`}>Features</Link>
              <Link href={`/configuration${q}`}>Configuration</Link>
              <Link href={`/audit${q}`}>Audit</Link>
            </nav>
          </ForgePageSection>
        </>
      ) : null}
    </ForgePageContainer>
  );
}

export default function TenantDetailPage() {
  return (
    <Suspense fallback={<p className={styles.muted}>Loading…</p>}>
      <TenantDetailInner />
    </Suspense>
  );
}
