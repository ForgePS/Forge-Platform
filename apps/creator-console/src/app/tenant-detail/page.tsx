"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState, type ReactNode } from "react";
import { INDUSTRIAL_PRODUCT_CODE } from "@forge/contracts";
import {
  CreatorLoading,
  CreatorPage,
  EmptyState,
  ErrorState,
  ForgePageSection,
  ForgeStatusBadge,
} from "@/components/creator-page";
import { apiGet, apiGetResult, apiSend, listMemberships, toIfMatch } from "@/lib/api";
import { getMigrationStatusService } from "@/lib/migrations/mock-migration.service";
import { migrationStageLabel, type MigrationSummary } from "@/lib/migrations/migration.types";
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
  products?: Array<{ productCode: string; productName?: string; status?: string }>;
  modules?: Array<{ moduleCode: string; moduleName?: string; status?: string }>;
};

type UserRow = {
  id: string;
  primaryEmail: string;
  status: string;
};

type Subscription = {
  id: string;
  status: string;
  planCode: string | null;
  billingCycle: string | null;
  startedAt: string | null;
  endsAt: string | null;
};

type AuditEvent = {
  id: string;
  action: string;
  resourceType: string;
  result: string;
  occurredAt: string;
};

type TabId =
  | "overview"
  | "users"
  | "facilities"
  | "products"
  | "billing"
  | "migration"
  | "files"
  | "branding"
  | "webAddress"
  | "support"
  | "activity"
  | "technical";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "users", label: "Users" },
  { id: "facilities", label: "Facilities" },
  { id: "products", label: "Products & Modules" },
  { id: "billing", label: "Billing" },
  { id: "migration", label: "Migration" },
  { id: "files", label: "Files" },
  { id: "branding", label: "Branding" },
  { id: "webAddress", label: "Web Address" },
  { id: "support", label: "Support" },
  { id: "activity", label: "Activity" },
  { id: "technical", label: "Technical (Advanced)" },
];

const INDUSTRIAL_APP_URL =
  process.env.NEXT_PUBLIC_INDUSTRIAL_APP_URL?.replace(/\/$/, "") ??
  "https://industrial-dev.forgepublicsafety.com";

const NA = "Not available";

function friendlyError(err: unknown): string {
  if (err instanceof Error && err.message.trim()) {
    const msg = err.message.trim();
    if (/failed to fetch|networkerror|load failed/i.test(msg)) {
      return "We couldn't load this information.";
    }
    return msg;
  }
  return "We couldn't load this information.";
}

function isActiveEntitlement(status: string | undefined): boolean {
  if (!status) return true;
  const s = status.toUpperCase();
  return s === "ACTIVE" || s === "ENTITLED";
}

function productLabel(code: string, name?: string): string {
  if (name?.trim()) return name;
  const map: Record<string, string> = {
    FORGE_RMS: "Forge RMS",
    FORGE_INDUSTRIAL: "Forge Industrial Safety",
    FORGE_ACADEMY: "Forge Academy",
    FORGE_CREATOR: "Forge Creator",
  };
  return map[code] ?? code;
}

function ValueOrNa({ value }: { value: ReactNode }) {
  if (value == null || value === "") return <span className={styles.muted}>{NA}</span>;
  return <>{value}</>;
}

function TenantDetailInner() {
  const searchParams = useSearchParams();
  const tenantId = searchParams.get("tenantId");

  const [tab, setTab] = useState<TabId>("overview");
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [etag, setEtag] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(tenantId));
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [suspendReason, setSuspendReason] = useState("");

  const [industrialEntitled, setIndustrialEntitled] = useState(false);
  const [entitlements, setEntitlements] = useState<EntitlementSnapshot | null>(null);
  const [entitlementsOk, setEntitlementsOk] = useState(false);
  const [primaryAdmin, setPrimaryAdmin] = useState<string | null>(null);
  const [primaryAdminOk, setPrimaryAdminOk] = useState(false);
  const [userCount, setUserCount] = useState<number | null>(null);
  const [usersOk, setUsersOk] = useState(false);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [subscriptionOk, setSubscriptionOk] = useState(false);
  const [migration, setMigration] = useState<MigrationSummary | null>(null);
  const [migrationOk, setMigrationOk] = useState(false);
  const [activity, setActivity] = useState<AuditEvent[] | null>(null);
  const [activityOk, setActivityOk] = useState(false);
  const [usersPreview, setUsersPreview] = useState<UserRow[]>([]);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    setActionError(null);
    setEntitlements(null);
    setEntitlementsOk(false);
    setPrimaryAdmin(null);
    setPrimaryAdminOk(false);
    setUserCount(null);
    setUsersOk(false);
    setSubscription(null);
    setSubscriptionOk(false);
    setMigration(null);
    setMigrationOk(false);
    setActivity(null);
    setActivityOk(false);
    setUsersPreview([]);
    setIndustrialEntitled(false);

    try {
      const result = await apiGetResult<Tenant>(`/api/v1/platform/tenants/${tenantId}`);
      setTenant(result.data);
      setEtag(result.etag ?? toIfMatch(result.data.recordVersion));

      const sideEffects = await Promise.allSettled([
        apiGet<EntitlementSnapshot>(`/api/v1/tenants/${tenantId}/entitlements`),
        listMemberships(tenantId),
        apiGet<UserRow[]>(`/api/v1/tenants/${tenantId}/users`),
        apiGet<Subscription>(`/api/v1/tenants/${tenantId}/subscriptions/current`),
        getMigrationStatusService().listMigrations(),
        apiGet<AuditEvent[]>(`/api/v1/tenants/${tenantId}/audit-events?page=1&pageSize=5`),
      ]);

      if (sideEffects[0].status === "fulfilled") {
        const ents = sideEffects[0].value;
        setEntitlements(ents);
        setEntitlementsOk(true);
        const products = ents.products ?? [];
        setIndustrialEntitled(
          products.some(
            (p) =>
              p.productCode === INDUSTRIAL_PRODUCT_CODE && isActiveEntitlement(p.status),
          ),
        );
      }

      if (sideEffects[1].status === "fulfilled") {
        const memberships = sideEffects[1].value;
        setPrimaryAdminOk(true);
        const active = memberships.find((m) => m.status === "ACTIVE") ?? memberships[0];
        setPrimaryAdmin(active?.email ?? null);
      }

      if (sideEffects[2].status === "fulfilled") {
        const users = sideEffects[2].value;
        setUsersOk(true);
        setUserCount(users.length);
        setUsersPreview(users.slice(0, 8));
      }

      if (sideEffects[3].status === "fulfilled") {
        setSubscriptionOk(true);
        setSubscription(sideEffects[3].value);
      }

      if (sideEffects[4].status === "fulfilled") {
        setMigrationOk(true);
        const match = sideEffects[4].value.find((m) => m.tenantId === tenantId) ?? null;
        setMigration(match);
      }

      if (sideEffects[5].status === "fulfilled") {
        setActivityOk(true);
        setActivity(sideEffects[5].value);
      }
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

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
    setActionError(null);
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
      setActionError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  async function suspend() {
    if (!tenantId) return;
    if (!suspendReason.trim()) {
      setActionError("Suspend requires a reason");
      return;
    }
    setBusy(true);
    setActionError(null);
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
      setActionError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  if (!tenantId) {
    return (
      <CreatorPage title="Customer" subtitle="Missing customer selection.">
        <p className={styles.error}>Open a customer from the Customers list.</p>
        <Link className="forge-btn forge-btn--secondary" href="/tenants">
          Back to Customers
        </Link>
      </CreatorPage>
    );
  }

  const q = `?tenantId=${encodeURIComponent(tenantId)}`;
  const hostname = tenant ? `${tenant.slug}.forgepublicsafety.com` : null;
  const webConnected = tenant?.status === "ACTIVE";
  const productNames =
    entitlementsOk && entitlements
      ? (entitlements.products ?? [])
          .filter((p) => isActiveEntitlement(p.status))
          .map((p) => productLabel(p.productCode, p.productName))
      : null;
  const moduleNames =
    entitlementsOk && entitlements
      ? (entitlements.modules ?? [])
          .filter((m) => isActiveEntitlement(m.status))
          .map((m) => m.moduleName?.trim() || m.moduleCode)
      : null;

  return (
    <CreatorPage
      title={tenant?.displayName ?? "Customer"}
      subtitle="Customer operating workspace — overview, access, products, and lifecycle."
      width="wide"
      actions={
        <Link className="forge-btn forge-btn--secondary" href="/tenants">
          Back to Customers
        </Link>
      }
    >
      {error ? (
        <ErrorState
          title="We couldn't load this information."
          description={error}
        />
      ) : null}
      {error ? (
        <div className={styles.actions} style={{ marginBottom: "1rem" }}>
          <button className={styles.buttonSecondary} type="button" onClick={() => void load()}>
            Try Again
          </button>
        </div>
      ) : null}
      {actionError ? <p className={styles.error}>{actionError}</p> : null}
      {loading ? <p className={styles.muted}>Loading…</p> : null}

      {tenant ? (
        <>
          <ForgePageSection title={tenant.displayName}>
            <div className={styles.actions} style={{ marginBottom: "0.75rem" }}>
              <ForgeStatusBadge status={tenant.status} />
              <span className={styles.mono}>{hostname}</span>
              <ForgeStatusBadge
                status={webConnected ? "ACTIVE" : "PENDING"}
                label={webConnected ? "Connected" : "Pending"}
              />
            </div>
            <div className={styles.actions}>
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
              <Link className="forge-btn forge-btn--outline" href={`/users${q}`}>
                Add User
              </Link>
              <Link className="forge-btn forge-btn--outline" href={`/entitlements${q}`}>
                Manage Products
              </Link>
              <Link className="forge-btn forge-btn--outline" href={`/support/session${q}`}>
                Open Support Session
              </Link>
            </div>
          </ForgePageSection>

          <div role="tablist" aria-label="Customer workspace" className={styles.tabList}>
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                id={`tab-${item.id}`}
                aria-selected={tab === item.id}
                aria-controls={`panel-${item.id}`}
                className={styles.tab}
                onClick={() => setTab(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div
            role="tabpanel"
            id={`panel-${tab}`}
            aria-labelledby={`tab-${tab}`}
            className={styles.tabPanel}
          >
            {tab === "overview" ? (
              <div className={styles.overviewGrid}>
                <div className={styles.cardBlock}>
                  <h3>Customer</h3>
                  <dl className={styles.dl}>
                    <dt>Customer name</dt>
                    <dd>{tenant.displayName}</dd>
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
                  </dl>
                </div>

                <div className={styles.cardBlock}>
                  <h3>Primary Administrator</h3>
                  <p>
                    <ValueOrNa
                      value={
                        primaryAdminOk
                          ? primaryAdmin
                          : null
                      }
                    />
                  </p>
                </div>

                <div className={styles.cardBlock}>
                  <h3>Products & Modules</h3>
                  {!entitlementsOk ? (
                    <p className={styles.muted}>{NA}</p>
                  ) : !productNames?.length && !moduleNames?.length ? (
                    <p className={styles.muted}>{NA}</p>
                  ) : (
                    <>
                      {productNames && productNames.length > 0 ? (
                        <p>{productNames.join(", ")}</p>
                      ) : null}
                      {moduleNames && moduleNames.length > 0 ? (
                        <p className={styles.muted}>{moduleNames.join(", ")}</p>
                      ) : null}
                    </>
                  )}
                  <Link href={`/entitlements${q}`}>Manage Products</Link>
                </div>

                <div className={styles.cardBlock}>
                  <h3>Facilities</h3>
                  <p className={styles.muted}>{NA}</p>
                  <nav className={styles.linkRow}>
                    <Link href={`/studio/facilities${q}`}>Facilities</Link>
                    <Link href={`/organizations${q}`}>Organizations</Link>
                  </nav>
                </div>

                <div className={styles.cardBlock}>
                  <h3>Users</h3>
                  <p>
                    {usersOk ? (
                      <>
                        {userCount} user{userCount === 1 ? "" : "s"} ·{" "}
                        <Link href={`/users${q}`}>Open Users</Link>
                      </>
                    ) : (
                      <span className={styles.muted}>{NA}</span>
                    )}
                  </p>
                </div>

                <div className={styles.cardBlock}>
                  <h3>Subscription</h3>
                  {!subscriptionOk || !subscription ? (
                    <p className={styles.muted}>{NA}</p>
                  ) : (
                    <dl className={styles.dl}>
                      <dt>Status</dt>
                      <dd>
                        <ForgeStatusBadge status={subscription.status} />
                      </dd>
                      <dt>Plan</dt>
                      <dd>{subscription.planCode ?? "—"}</dd>
                      <dt>Billing cycle</dt>
                      <dd>{subscription.billingCycle ?? "—"}</dd>
                    </dl>
                  )}
                  <Link href={`/subscriptions${q}`}>Subscriptions</Link>
                </div>

                <div className={styles.cardBlock}>
                  <h3>Migration Status</h3>
                  {!migrationOk || !migration ? (
                    <p className={styles.muted}>{NA}</p>
                  ) : (
                    <>
                      <p>
                        <ForgeStatusBadge
                          status={migration.status}
                          label={migrationStageLabel(migration.status)}
                        />
                        {migration.progressPercent != null
                          ? ` · ${migration.progressPercent}%`
                          : ""}
                      </p>
                      <Link href={`/migrations/detail?id=${encodeURIComponent(migration.id)}`}>
                        Open migration
                      </Link>
                    </>
                  )}
                </div>

                <div className={styles.cardBlock}>
                  <h3>Application Health</h3>
                  <Link href="/health">Open System Health</Link>
                </div>

                <div className={styles.cardBlock}>
                  <h3>Recent Activity</h3>
                  {!activityOk || !activity ? (
                    <p className={styles.muted}>{NA}</p>
                  ) : activity.length === 0 ? (
                    <p className={styles.muted}>No recent events.</p>
                  ) : (
                    <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
                      {activity.map((ev) => (
                        <li key={ev.id}>
                          {ev.action} · {ev.resourceType} ·{" "}
                          <ForgeStatusBadge status={ev.result} />
                        </li>
                      ))}
                    </ul>
                  )}
                  <Link href={`/audit${q}`}>Audit log</Link>
                </div>

                <div className={styles.cardBlock}>
                  <h3>Open Issues</h3>
                  <p className={styles.muted}>{NA}</p>
                </div>

                <div className={styles.cardBlock}>
                  <h3>Renewal</h3>
                  <p className={styles.muted}>{NA}</p>
                </div>
              </div>
            ) : null}

            {tab === "users" ? (
              <ForgePageSection title="Users" description="Manage access for this customer.">
                <nav className={styles.linkRow}>
                  <Link className="forge-btn forge-btn--outline" href={`/users${q}`}>
                    Users
                  </Link>
                  <Link className="forge-btn forge-btn--outline" href={`/invitations${q}`}>
                    Invitations
                  </Link>
                  <Link className="forge-btn forge-btn--outline" href={`/memberships${q}`}>
                    Memberships
                  </Link>
                </nav>
                {usersOk && usersPreview.length > 0 ? (
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Email</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usersPreview.map((u) => (
                        <tr key={u.id}>
                          <td>{u.primaryEmail}</td>
                          <td>
                            <ForgeStatusBadge status={u.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className={styles.muted}>
                    {usersOk ? "No users listed yet." : NA}
                  </p>
                )}
              </ForgePageSection>
            ) : null}

            {tab === "facilities" ? (
              <ForgePageSection title="Facilities">
                <nav className={styles.linkRow}>
                  <Link href={`/studio/facilities${q}`}>Studio Facilities</Link>
                  <Link href={`/organizations${q}`}>Organizations</Link>
                </nav>
                <p className={styles.muted}>
                  Facility counts are not available from a dedicated API yet.
                </p>
              </ForgePageSection>
            ) : null}

            {tab === "products" ? (
              <ForgePageSection title="Products & Modules">
                <Link className="forge-btn forge-btn--outline" href={`/entitlements${q}`}>
                  Open Products & Modules
                </Link>
                {!entitlementsOk ? (
                  <p className={styles.muted} style={{ marginTop: "0.75rem" }}>
                    {NA}
                  </p>
                ) : (
                  <dl className={styles.dl} style={{ marginTop: "0.75rem" }}>
                    <dt>Products</dt>
                    <dd>
                      {productNames && productNames.length > 0
                        ? productNames.join(", ")
                        : NA}
                    </dd>
                    <dt>Modules</dt>
                    <dd>
                      {moduleNames && moduleNames.length > 0
                        ? moduleNames.join(", ")
                        : NA}
                    </dd>
                  </dl>
                )}
              </ForgePageSection>
            ) : null}

            {tab === "billing" ? (
              <ForgePageSection title="Billing">
                <nav className={styles.linkRow}>
                  <Link href={`/subscriptions${q}`}>Subscriptions</Link>
                  <Link href={`/billing${q}`}>Billing</Link>
                </nav>
                {!subscriptionOk || !subscription ? (
                  <p className={styles.muted}>{NA}</p>
                ) : (
                  <dl className={styles.dl}>
                    <dt>Current status</dt>
                    <dd>
                      <ForgeStatusBadge status={subscription.status} />
                    </dd>
                    <dt>Plan</dt>
                    <dd>{subscription.planCode ?? "—"}</dd>
                  </dl>
                )}
              </ForgePageSection>
            ) : null}

            {tab === "migration" ? (
              <ForgePageSection title="Migration">
                <nav className={styles.linkRow}>
                  <Link href="/migrations">Migration Center</Link>
                  {migration ? (
                    <Link href={`/migrations/detail?id=${encodeURIComponent(migration.id)}`}>
                      Reconciliation / detail
                    </Link>
                  ) : null}
                </nav>
                {!migrationOk || !migration ? (
                  <p className={styles.muted}>{NA}</p>
                ) : (
                  <dl className={styles.dl}>
                    <dt>Status</dt>
                    <dd>{migrationStageLabel(migration.status)}</dd>
                    <dt>Progress</dt>
                    <dd>
                      {migration.progressPercent != null
                        ? `${migration.progressPercent}%`
                        : "—"}
                    </dd>
                    <dt>Summary</dt>
                    <dd>{migration.validationSummary}</dd>
                  </dl>
                )}
              </ForgePageSection>
            ) : null}

            {tab === "files" ? (
              <EmptyState
                title="File transfer workspace is managed in Migration Center"
                description="Use Migration Center for import packages, document transfer, and cutover files."
                action={
                  <Link className="forge-btn forge-btn--outline" href="/migrations">
                    Open Migration Center
                  </Link>
                }
              />
            ) : null}

            {tab === "branding" ? (
              <ForgePageSection title="Branding">
                <Link className="forge-btn forge-btn--outline" href={`/branding${q}`}>
                  Open Branding
                </Link>
              </ForgePageSection>
            ) : null}

            {tab === "webAddress" ? (
              <ForgePageSection title="Web Address">
                <dl className={styles.dl}>
                  <dt>Primary hostname</dt>
                  <dd className={styles.mono}>{hostname}</dd>
                  <dt>Status</dt>
                  <dd>
                    <ForgeStatusBadge
                      status={webConnected ? "ACTIVE" : "PENDING"}
                      label={webConnected ? "Connected" : "Pending"}
                    />
                  </dd>
                  <dt>SSL</dt>
                  <dd>Secure</dd>
                  <dt>Product</dt>
                  <dd>{industrialEntitled ? "Industrial" : entitlementsOk ? "—" : NA}</dd>
                </dl>
                <details className="forge-advanced-details">
                  <summary>Advanced details</summary>
                  <p className={styles.muted}>
                    DNS and certificate details are managed by Forge operations.
                  </p>
                </details>
              </ForgePageSection>
            ) : null}

            {tab === "support" ? (
              <ForgePageSection title="Support">
                <nav className={styles.linkRow}>
                  <Link className="forge-btn" href={`/support/session${q}`}>
                    Start support session
                  </Link>
                  <Link className="forge-btn forge-btn--outline" href="/support">
                    Open Support Center
                  </Link>
                </nav>
              </ForgePageSection>
            ) : null}

            {tab === "activity" ? (
              <ForgePageSection title="Activity">
                <Link className="forge-btn forge-btn--outline" href={`/audit${q}`}>
                  Open audit log
                </Link>
                {!activityOk || !activity ? (
                  <p className={styles.muted} style={{ marginTop: "0.75rem" }}>
                    {NA}
                  </p>
                ) : activity.length === 0 ? (
                  <p className={styles.muted} style={{ marginTop: "0.75rem" }}>
                    No recent events.
                  </p>
                ) : (
                  <table className={styles.table} style={{ marginTop: "0.75rem" }}>
                    <thead>
                      <tr>
                        <th>When</th>
                        <th>Action</th>
                        <th>Resource</th>
                        <th>Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activity.map((ev) => (
                        <tr key={ev.id}>
                          <td>{new Date(ev.occurredAt).toLocaleString()}</td>
                          <td>{ev.action}</td>
                          <td>{ev.resourceType}</td>
                          <td>
                            <ForgeStatusBadge status={ev.result} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </ForgePageSection>
            ) : null}

            {tab === "technical" ? (
              <ForgePageSection title="Technical (Advanced)">
                <dl className={styles.dl}>
                  <dt>Customer ID</dt>
                  <dd className={styles.mono}>{tenant.id}</dd>
                  <dt>Key</dt>
                  <dd className={styles.mono}>{tenant.tenantKey}</dd>
                  <dt>Slug</dt>
                  <dd className={styles.mono}>{tenant.slug}</dd>
                  <dt>Record version</dt>
                  <dd className={styles.mono}>{tenant.recordVersion}</dd>
                  {etag ? (
                    <>
                      <dt>ETag</dt>
                      <dd className={styles.mono}>{etag}</dd>
                    </>
                  ) : null}
                </dl>

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
            ) : null}
          </div>
        </>
      ) : null}
    </CreatorPage>
  );
}

export default function TenantDetailPage() {
  return (
    <Suspense fallback={<CreatorLoading />}>
      <TenantDetailInner />
    </Suspense>
  );
}
