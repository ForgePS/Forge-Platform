"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { ComingLater, ForgePageHeader, StatusBadge, Tabs } from "@forge/ui";
import { PlatformPageGate } from "@/components/platform-page-gate";
import { listMemberships, type Membership, apiGet, apiGetResult, apiSend, toIfMatch } from "@/lib/api";
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

type Facility = {
  id: string;
  facilityKey: string;
  name: string;
  status: string;
  facilityType: string | null;
};

type Branding = {
  primaryColor: string | null;
  secondaryColor: string | null;
  supportEmail: string | null;
  emailSenderName: string | null;
};

type Entitlements = {
  products: Array<{ productCode: string; productName: string; status: string }>;
  modules: Array<{ moduleCode: string; moduleName: string; status: string }>;
};

type Feature = { key: string; name: string; value: unknown; valueType: string };

type AuditEvent = {
  id: string;
  action: string;
  resourceType: string;
  result: string;
  occurredAt: string;
};

type BillingOverview = {
  customer: { billingEmail: string | null } | null;
  subscription: {
    status: string;
    planCode: string | null;
    planName: string | null;
    billingInterval: string | null;
  } | null;
  contracts: Array<{
    id: string;
    name: string;
    status: string;
    billingType: string;
    startsOn: string | null;
    endsOn: string | null;
  }>;
  invoices: Array<{ id: string; status: string; amountDueCents: number; createdAt: string }>;
};

const CUSTOMER_TABS = [
  { id: "overview", label: "Overview" },
  { id: "facilities", label: "Facilities" },
  { id: "users", label: "Users" },
  { id: "products", label: "Products" },
  { id: "modules", label: "Modules" },
  { id: "branding", label: "Branding" },
  { id: "domains", label: "Domains" },
  { id: "billing", label: "Billing" },
  { id: "migration", label: "Migration" },
  { id: "audit", label: "Audit" },
] as const;

function TenantDetailInner() {
  const searchParams = useSearchParams();
  const tenantId = searchParams.get("tenantId");

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [etag, setEtag] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(tenantId));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [suspendReason, setSuspendReason] = useState("");

  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [members, setMembers] = useState<Membership[]>([]);
  const [branding, setBranding] = useState<Branding | null>(null);
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [billing, setBilling] = useState<BillingOverview | null>(null);
  const [sectionErrors, setSectionErrors] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<string>("overview");

  const loadCore = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await apiGetResult<Tenant>(`/api/v1/platform/tenants/${tenantId}`);
      setTenant(result.data);
      setEtag(result.etag ?? toIfMatch(result.data.recordVersion));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tenant");
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  const loadSections = useCallback(async () => {
    if (!tenantId) return;
    const nextErrors: Record<string, string> = {};

    const settle = async <T,>(
      key: string,
      promise: Promise<T>,
      apply: (value: T) => void,
    ) => {
      try {
        apply(await promise);
      } catch (err) {
        nextErrors[key] = err instanceof Error ? err.message : `Failed to load ${key}`;
      }
    };

    await Promise.all([
      settle("facilities", apiGet<Facility[]>(`/api/v1/tenants/${tenantId}/facilities`), setFacilities),
      settle("members", listMemberships(tenantId), setMembers),
      settle(
        "branding",
        apiGet<Branding | null>(`/api/v1/tenants/${tenantId}/branding`),
        (row) => setBranding(row),
      ),
      settle(
        "entitlements",
        apiGet<Entitlements>(`/api/v1/tenants/${tenantId}/entitlements`),
        setEntitlements,
      ),
      settle(
        "features",
        apiGet<Feature[]>(`/api/v1/tenants/${tenantId}/features/effective`),
        setFeatures,
      ),
      settle(
        "audit",
        apiGet<AuditEvent[]>(`/api/v1/tenants/${tenantId}/audit-events?page=1&pageSize=20`),
        setAudit,
      ),
      settle(
        "billing",
        apiGet<BillingOverview>(`/api/v1/tenants/${tenantId}/billing/overview`),
        setBilling,
      ),
    ]);

    setSectionErrors(nextErrors);
  }, [tenantId]);

  useEffect(() => {
    void loadCore();
  }, [loadCore]);

  useEffect(() => {
    if (tenant) void loadSections();
  }, [tenant, loadSections]);

  async function resolveIfMatch(): Promise<string> {
    if (!tenantId) throw new Error("Missing tenantId");
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
      <section className={styles.page}>
        <h1>Customer detail</h1>
        <p className={styles.error}>Missing tenantId query parameter.</p>
        <Link href="/customers/">← Customers</Link>
      </section>
    );
  }

  const q = `?tenantId=${encodeURIComponent(tenantId)}`;

  return (
    <section className={styles.page}>
      <ForgePageHeader
        title={tenant?.displayName ?? "Customer detail"}
        subtitle={
          tenant
            ? `Status ${tenant.status}`
            : "Customer detail from live platform APIs."
        }
        actions={
          <>
            <Link
              className="forge-btn"
              href={`/customer-modules/?tenantId=${encodeURIComponent(tenantId)}`}
            >
              Manage Modules
            </Link>
            <Link className="forge-btn forge-btn--outline" href="/customers/">
              All customers
            </Link>
          </>
        }
      />

      {error ? <p className={styles.error}>{error}</p> : null}
      {loading ? <p className={styles.muted}>Loading…</p> : null}

      {tenant ? (
        <>
          <p style={{ marginBottom: "1rem" }}>
            Status{" "}
            <StatusBadge tone={tenant.status === "ACTIVE" ? "success" : tenant.status === "SUSPENDED" ? "danger" : "info"}>
              {tenant.status}
            </StatusBadge>
          </p>
          <Tabs items={[...CUSTOMER_TABS]} value={tab} onChange={setTab} />

          {tab === "overview" ? (
            <>
          <div className={styles.panel} id="summary">
            <h2>Summary</h2>
            <dl className={styles.dl}>
              <dt>ID</dt>
              <dd className={styles.mono}>{tenant.id}</dd>
              <dt>Key</dt>
              <dd className={styles.mono}>{tenant.tenantKey}</dd>
              <dt>Slug</dt>
              <dd className={styles.mono}>{tenant.slug}</dd>
              <dt>Legal name</dt>
              <dd>{tenant.legalName}</dd>
              <dt>Type</dt>
              <dd>{tenant.tenantType}</dd>
              <dt>Timezone</dt>
              <dd>{tenant.timezone}</dd>
              <dt>Locale</dt>
              <dd>{tenant.defaultLocale}</dd>
              <dt>Region</dt>
              <dd>{tenant.dataRegion}</dd>
              {etag ? (
                <>
                  <dt>Version</dt>
                  <dd className={styles.mono}>{tenant.recordVersion}</dd>
                </>
              ) : null}
            </dl>
            <nav className={styles.linkRow} style={{ marginTop: "0.75rem" }}>
              <Link href={`/setup-center/?tenantId=${encodeURIComponent(tenantId)}`}>Setup Center</Link>
              <Link href={`/onboarding/`}>Onboarding</Link>
              <Link href={`/imports/?tenantId=${encodeURIComponent(tenantId)}`}>Data import</Link>
            </nav>
          </div>

          <div className={styles.panel} id="status">
            <h2>Status</h2>
            <p>
              Current status: <strong>{tenant.status}</strong>
            </p>
            <div className={styles.actions} style={{ marginTop: "1rem" }}>
              <button className={styles.button} type="button" disabled={busy} onClick={() => void activate()}>
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
          </div>

          <div className={styles.panel} id="contacts">
            <h2>Contacts</h2>
            {sectionErrors.billing ? <p className={styles.error}>{sectionErrors.billing}</p> : null}
            <dl className={styles.dl}>
              <dt>Billing email</dt>
              <dd>{billing?.customer?.billingEmail ?? "—"}</dd>
              <dt>Support email</dt>
              <dd>{branding?.supportEmail ?? "—"}</dd>
              <dt>Email sender</dt>
              <dd>{branding?.emailSenderName ?? "—"}</dd>
            </dl>
            <nav className={styles.linkRow}>
              <Link href={`/persons${q}`}>Persons</Link>
              <Link href={`/billing${q}`}>Billing contact</Link>
            </nav>
          </div>

          <div className={styles.panel} id="feature-flags">
            <h2>Feature flags</h2>
            {sectionErrors.features ? <p className={styles.error}>{sectionErrors.features}</p> : null}
            {features.length === 0 ? (
              <p className={styles.muted}>No effective features.</p>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Key</th>
                    <th>Name</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {features.slice(0, 15).map((row) => (
                    <tr key={row.key}>
                      <td className={styles.mono}>{row.key}</td>
                      <td>{row.name}</td>
                      <td className={styles.mono}>{JSON.stringify(row.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <nav className={styles.linkRow}>
              <Link href={`/features${q}`}>Feature Flags</Link>
            </nav>
          </div>
            </>
          ) : null}

          {tab === "facilities" ? (
          <div className={styles.panel} id="facilities">
            <h2>Facilities</h2>
            {sectionErrors.facilities ? (
              <p className={styles.error}>{sectionErrors.facilities}</p>
            ) : null}
            {facilities.length === 0 ? (
              <p className={styles.muted}>No facilities (or unavailable).</p>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Key</th>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {facilities.slice(0, 10).map((row) => (
                    <tr key={row.id}>
                      <td className={styles.mono}>{row.facilityKey}</td>
                      <td>{row.name}</td>
                      <td>{row.facilityType ?? "—"}</td>
                      <td>{row.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <nav className={styles.linkRow}>
              <Link href={`/studio/facilities${q}`}>Studio · Facilities</Link>
            </nav>
          </div>
          ) : null}

          {tab === "users" ? (
          <div className={styles.panel} id="members">
            <h2>Users</h2>
            {sectionErrors.members ? <p className={styles.error}>{sectionErrors.members}</p> : null}
            {members.length === 0 ? (
              <p className={styles.muted}>No memberships (or unavailable).</p>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Status</th>
                    <th>User status</th>
                  </tr>
                </thead>
                <tbody>
                  {members.slice(0, 10).map((row) => (
                    <tr key={row.id}>
                      <td>{row.email}</td>
                      <td>{row.status}</td>
                      <td>{row.userStatus}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <nav className={styles.linkRow}>
              <Link href={`/memberships${q}`}>Memberships</Link>
              <Link href={`/users${q}`}>Users</Link>
            </nav>
          </div>
          ) : null}

          {tab === "products" ? (
          <div className={styles.panel} id="products">
            <h2>Products</h2>
            {sectionErrors.entitlements ? (
              <p className={styles.error}>{sectionErrors.entitlements}</p>
            ) : null}
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { code: "FORGE_INDUSTRIAL", name: "Forge Industrial Safety" },
                  { code: "FORGE_RMS", name: "Forge RMS" },
                  { code: "FORGE_ACADEMY", name: "Forge Academy" },
                ].map((catalog) => {
                  const row = entitlements?.products?.find((p) => p.productCode === catalog.code);
                  const status = row?.status ?? "NOT PURCHASED";
                  const active = status === "ACTIVE";
                  const industrialUrl =
                    process.env.NEXT_PUBLIC_INDUSTRIAL_APP_URL?.replace(/\/$/, "") ||
                    "https://d1n0e5wvjwbpdf.cloudfront.net";
                  return (
                    <tr key={catalog.code}>
                      <td>
                        {catalog.name}
                        <div className={styles.mono}>{catalog.code}</div>
                      </td>
                      <td>
                        <StatusBadge tone={active ? "success" : status === "NOT PURCHASED" ? "neutral" : "warning"}>
                          {status}
                        </StatusBadge>
                      </td>
                      <td>
                        {catalog.code === "FORGE_INDUSTRIAL" && active ? (
                          <a
                            className="forge-btn forge-btn--outline"
                            href={`${industrialUrl}/?tenantId=${encodeURIComponent(tenantId)}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open Industrial
                          </a>
                        ) : null}
                        {catalog.code === "FORGE_INDUSTRIAL" && !active ? (
                          <>
                            <Link className="forge-btn forge-btn--outline" href={`/entitlements${q}`}>
                              Configure Product
                            </Link>{" "}
                            <a
                              className="forge-btn forge-btn--secondary"
                              href={`${industrialUrl}/?tenantId=${encodeURIComponent(tenantId)}`}
                              target="_blank"
                              rel="noreferrer"
                              title="Platform Admin support preview"
                            >
                              Admin Preview
                            </a>
                          </>
                        ) : null}
                        {catalog.code !== "FORGE_INDUSTRIAL" ? (
                          <Link href={`/entitlements${q}`}>Manage</Link>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {(entitlements?.products?.length ?? 0) === 0 ? (
              <p className={styles.muted}>No product entitlements returned from API (shown as NOT PURCHASED).</p>
            ) : null}
            <nav className={styles.linkRow}>
              <Link href={`/entitlements${q}`}>Entitlements</Link>
              <Link href="/products">Catalog</Link>
            </nav>
          </div>
          ) : null}

          {tab === "modules" ? (
          <div className={styles.panel} id="modules">
            <h2>Modules</h2>
            <p className={styles.muted}>
              Manage Forge Industrial Safety module access with Ready / On / Off controls. Migration
              constants stay in technical details.
            </p>
            {(entitlements?.modules?.length ?? 0) === 0 ? (
              <p className={styles.muted}>No module entitlements assigned yet.</p>
            ) : (
              <ul>
                {entitlements!.modules.map((row) => (
                  <li key={row.moduleCode}>
                    {row.moduleName} · {row.status === "ACTIVE" ? "On" : "Off"}
                  </li>
                ))}
              </ul>
            )}
            <nav className={styles.linkRow}>
              <Link className="forge-btn" href={`/customer-modules/?tenantId=${encodeURIComponent(tenantId)}`}>
                Manage Modules
              </Link>
              <Link href="/modules">Module catalog</Link>
            </nav>
          </div>
          ) : null}

          {tab === "branding" ? (
          <div className={styles.panel} id="branding">
            <h2>Branding</h2>
            {sectionErrors.branding ? <p className={styles.error}>{sectionErrors.branding}</p> : null}
            <dl className={styles.dl}>
              <dt>Primary</dt>
              <dd className={styles.mono}>{branding?.primaryColor ?? "—"}</dd>
              <dt>Secondary</dt>
              <dd className={styles.mono}>{branding?.secondaryColor ?? "—"}</dd>
            </dl>
            <nav className={styles.linkRow}>
              <Link href={`/branding${q}`}>Branding editor</Link>
              <Link href={`/studio/branding${q}`}>Studio · Branding</Link>
            </nav>
          </div>
          ) : null}

          {tab === "domains" ? <ComingLater>Domains management — Coming later</ComingLater> : null}

          {tab === "billing" ? (
          <>
          <div className={styles.panel} id="subscription">
            <h2>Subscription</h2>
            {sectionErrors.billing ? <p className={styles.error}>{sectionErrors.billing}</p> : null}
            <dl className={styles.dl}>
              <dt>Status</dt>
              <dd>{billing?.subscription?.status ?? "None"}</dd>
              <dt>Plan</dt>
              <dd>
                {billing?.subscription?.planName ?? billing?.subscription?.planCode ?? "—"}
                {billing?.subscription?.billingInterval
                  ? ` · ${billing.subscription.billingInterval}`
                  : ""}
              </dd>
            </dl>
            <nav className={styles.linkRow}>
              <Link href={`/subscriptions${q}`}>Subscriptions</Link>
              <Link href="/plans">Plans</Link>
            </nav>
          </div>

          <div className={styles.panel} id="contract">
            <h2>Contract</h2>
            {(billing?.contracts?.length ?? 0) === 0 ? (
              <p className={styles.muted}>No contracts.</p>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Status</th>
                    <th>Type</th>
                    <th>Starts</th>
                    <th>Ends</th>
                  </tr>
                </thead>
                <tbody>
                  {billing!.contracts.map((row) => (
                    <tr key={row.id}>
                      <td>{row.name}</td>
                      <td>{row.status}</td>
                      <td className={styles.mono}>{row.billingType}</td>
                      <td>{row.startsOn ?? "—"}</td>
                      <td>{row.endsOn ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <nav className={styles.linkRow}>
              <Link href={`/contracts${q}`}>Contracts</Link>
              <Link href={`/billing${q}`}>Billing</Link>
            </nav>
          </div>

          <div className={styles.panel} id="usage">
            <h2>Usage</h2>
            <p className={styles.muted}>
              Invoice count: {billing?.invoices?.length ?? 0}. Open billing for amounts and
              payment portal status.
            </p>
            <nav className={styles.linkRow}>
              <Link href={`/billing${q}`}>Billing overview</Link>
              <Link href={`/ai/usage${q}`}>AI usage</Link>
            </nav>
          </div>
          </>
          ) : null}

          {tab === "migration" ? (
            <div className={styles.panel}>
              <h2>Migration</h2>
              <p className={styles.muted}>
                Open Migration Center for staged progress. Cutover is never single-click.
              </p>
              <nav className={styles.linkRow}>
                <Link href="/migrations/">Migration Center</Link>
              </nav>
              <ComingLater>Per-customer migration stepper wiring — Coming later when live adapter exists</ComingLater>
            </div>
          ) : null}

          {tab === "audit" ? (
          <>
          <div className={styles.panel} id="activity">
            <h2>Activity</h2>
            {audit.length === 0 ? (
              <p className={styles.muted}>No recent activity.</p>
            ) : (
              <ul>
                {audit.slice(0, 5).map((row) => (
                  <li key={row.id}>
                    <span className={styles.mono}>{row.occurredAt}</span> · {row.action} ·{" "}
                    {row.resourceType} · {row.result}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className={styles.panel} id="audit">
            <h2>Audit</h2>
            {sectionErrors.audit ? <p className={styles.error}>{sectionErrors.audit}</p> : null}
            {audit.length === 0 ? (
              <p className={styles.muted}>No audit events.</p>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Occurred</th>
                    <th>Action</th>
                    <th>Resource</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.map((row) => (
                    <tr key={row.id}>
                      <td className={styles.mono}>{row.occurredAt}</td>
                      <td>{row.action}</td>
                      <td>{row.resourceType}</td>
                      <td>{row.result}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <nav className={styles.linkRow}>
              <Link href={`/audit${q}`}>Full audit</Link>
            </nav>
          </div>
          </>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

export default function TenantDetailPage() {
  return (
    <PlatformPageGate title="Customer detail" permission="platform.tenant.read">
      <Suspense fallback={<p className={styles.muted}>Loading…</p>}>
        <TenantDetailInner />
      </Suspense>
    </PlatformPageGate>
  );
}
