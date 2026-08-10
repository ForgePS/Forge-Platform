"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthProvider, apiGet, useAuth } from "@forge/web-kit";
import { EnvironmentBanner } from "@forge/ui";
import { INDUSTRIAL_MODULE_REGISTRY, INDUSTRIAL_PRODUCT_CODE } from "@forge/contracts";
import { buildIndustrialNavigation, featureFlagForModule } from "@/lib/navigation";
import { clearAllOfflineData } from "@/lib/offline/cache";
import { NetworkStatusBanner } from "@/lib/offline/network-status";

const appEnv = process.env.NEXT_PUBLIC_APP_ENV ?? process.env.APP_ENV ?? "local";

function brandMark() {
  return (
    <svg width="25" viewBox="0 0 25 42" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        fill="#696cff"
        d="M13.79.36L3.4 7.44C.57 9.69-.38 12.48.56 15.8c.13.43.54 2 .2.56 2.56 3.12 4.28 5.32 5.6 7.65 6.06l-.05.04-4.96 3.3C.45 26.3.09 28.51 1.56 31.17c1.27 1.64 3.65 2.09 5.53 1.37 1.26-.48 4.36-2.54 9.33-6.16 1.61-1.88 2.28-3.92 1.99-6.14-.44-2.7-2.23-4.66-5.36-5.86l-2.13-.9L18.62 7.98 13.79.36z"
      />
    </svg>
  );
}

function iconForModule(code: string, group: string): string {
  const c = code.toLowerCase();
  if (c.includes("loto") || c.includes("lockout")) return "bx-lock-alt";
  if (c.includes("equipment")) return "bx-cog";
  if (c.includes("personnel") || c.includes("people")) return "bx-group";
  if (c.includes("training")) return "bx-book";
  if (c.includes("inspection")) return "bx-check-shield";
  if (c.includes("incident")) return "bx-error";
  if (c.includes("document")) return "bx-file";
  if (c.includes("report")) return "bx-bar-chart-alt-2";
  if (c.includes("qr")) return "bx-qr";
  if (c.includes("message")) return "bx-message";
  if (c.includes("task")) return "bx-task";
  if (c.includes("form")) return "bx-edit";
  if (c.includes("jsa")) return "bx-list-check";
  if (c.includes("observ")) return "bx-show";
  if (group.toLowerCase().includes("high")) return "bx-error-circle";
  return "bx-cube";
}

function GateCard({
  title,
  body,
  muted,
  children,
}: {
  title: string;
  body: string;
  muted?: string;
  children?: ReactNode;
}) {
  return (
    <div className="container-xxl">
      <div className="authentication-wrapper authentication-basic container-p-y">
        <div className="authentication-inner">
          <div className="card">
            <div className="card-body">
              <div className="app-brand justify-content-center mb-4">
                <span className="app-brand-logo demo">{brandMark()}</span>
                <span className="app-brand-text demo text-body fw-bolder ms-2">Industrial</span>
              </div>
              <h4 className="mb-2">{title}</h4>
              <p className="mb-4">{body}</p>
              {muted ? <p className="text-muted mb-4">{muted}</p> : null}
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ShellBody({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { me, loading, error, logout, loginWithCognito, chooseTenant, hasPermission } = useAuth();
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [menuOpen, setMenuOpen] = useState(false);
  const [tenantSwitching, setTenantSwitching] = useState(false);

  const signOut = async () => {
    clearAllOfflineData();
    await logout();
  };

  const isPublicAuthRoute =
    Boolean(pathname?.startsWith("/auth/callback")) || Boolean(pathname?.startsWith("/health"));

  const tenantId = me?.tenantId ?? null;
  const userId = me?.userId ?? null;
  const products = new Set(me?.activeProducts ?? []);
  const entitled = products.has(INDUSTRIAL_PRODUCT_CODE);
  // Prefer hasPermission so PLATFORM_SUPER_ADMIN matches API evaluateAuthorization
  // (isPlatformAdmin bypasses the industrial.access requirement).
  const hasIndustrialAccess = hasPermission("industrial.access");
  const permissions = new Set(me?.permissions ?? []);
  if (hasIndustrialAccess) {
    permissions.add("industrial.access");
  }
  const hasAccess = Boolean(me && tenantId && entitled && hasIndustrialAccess);

  useEffect(() => {
    if (!hasAccess || !tenantId) {
      setFlags({});
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const boot = await apiGet<{
          industrialEnabled: boolean;
          modules: Array<{ code: string; awsEnabled: boolean; featureFlagKey?: string }>;
        }>("/api/v1/industrial/bootstrap");
        if (cancelled) return;
        const next: Record<string, boolean> = {
          "industrial.enabled": Boolean(boot.industrialEnabled),
        };
        for (const m of boot.modules) {
          const key = m.featureFlagKey ?? featureFlagForModule(m.code);
          next[key] = Boolean(m.awsEnabled);
        }
        setFlags(next);
      } catch {
        if (!cancelled) setFlags({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hasAccess, tenantId, userId]);

  useEffect(() => {
    document.documentElement.classList.toggle("layout-menu-expanded", menuOpen);
  }, [menuOpen]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // FORGE-UI-S5: Escape closes drawer; lock body scroll while open.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  // Collapse overlay drawer when viewport crosses into desktop nav.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1200px)");
    const onChange = () => {
      if (mq.matches) setMenuOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  if (isPublicAuthRoute) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <GateCard title="Forge Industrial Safety" body="Loading your session…" />
    );
  }

  if (error || !me) {
    return (
      <GateCard
        title="Welcome to Forge Industrial Safety"
        body="Sign in is required to continue."
        muted={error ? error : "Unauthenticated"}
      >
        <button type="button" className="btn btn-primary d-grid w-100" onClick={() => void loginWithCognito()}>
          Sign in
        </button>
      </GateCard>
    );
  }

  if (!me.tenantId) {
    const selectable = me.tenants.filter((t) => t.selectable);
    return (
      <GateCard title="Select a tenant" body="Choose a tenant to continue." muted="No tenant selected">
        <div className="d-grid gap-2">
          {selectable.map((t) => (
            <button
              key={t.tenantId}
              type="button"
              className="btn btn-outline-primary"
              onClick={() => void chooseTenant(t.tenantId)}
            >
              {t.displayName}
            </button>
          ))}
        </div>
      </GateCard>
    );
  }

  if (!entitled) {
    const alternates = me.tenants.filter(
      (t) => t.selectable && t.tenantId !== me.tenantId,
    );
    return (
      <GateCard
        title="Product not entitled"
        body="This tenant is not entitled to Forge Industrial Safety."
        muted="Unauthorized product access"
      >
        {alternates.length > 0 ? (
          <div className="d-grid gap-2 mb-3">
            <p className="text-muted mb-0">Switch to another tenant:</p>
            {alternates.map((t) => (
              <button
                key={t.tenantId}
                type="button"
                className="btn btn-outline-primary"
                onClick={() => void chooseTenant(t.tenantId)}
              >
                {t.displayName}
              </button>
            ))}
          </div>
        ) : null}
        <button type="button" className="btn btn-outline-secondary d-grid w-100" onClick={() => void signOut()}>
          Sign out
        </button>
      </GateCard>
    );
  }

  if (!hasIndustrialAccess) {
    return (
      <GateCard
        title="Access denied"
        body="You do not have permission to access Forge Industrial Safety."
        muted="Missing industrial.access"
      />
    );
  }

  const nav = buildIndustrialNavigation({
    entitled: true,
    permissions,
    flags,
  });
  const groups = [...new Set(nav.map((n) => n.group))];
  const selectableTenants = me.tenants.filter((t) => t.selectable);
  const tenantLabel =
    selectableTenants.find((t) => t.tenantId === me.tenantId)?.displayName ??
    me.tenants.find((t) => t.tenantId === me.tenantId)?.displayName ??
    me.tenantId;

  const onTenantChange = async (nextTenantId: string) => {
    if (!nextTenantId || nextTenantId === me.tenantId || tenantSwitching) return;
    setTenantSwitching(true);
    try {
      await chooseTenant(nextTenantId);
    } finally {
      setTenantSwitching(false);
    }
  };

  return (
    <div className="layout-wrapper layout-content-navbar">
      <div className="layout-container">
        <aside id="layout-menu" className="layout-menu menu-vertical menu bg-menu-theme">
          <div className="app-brand demo">
            <Link href="/" className="app-brand-link" onClick={() => setMenuOpen(false)}>
              <span className="app-brand-logo demo">{brandMark()}</span>
              <span className="app-brand-text demo menu-text fw-bolder ms-2">Industrial</span>
            </Link>
            <button
              type="button"
              className="layout-menu-toggle menu-link text-large ms-auto d-block d-xl-none btn btn-link p-0 border-0"
              aria-label="Close menu"
              aria-expanded={menuOpen}
              aria-controls="layout-menu"
              onClick={() => setMenuOpen(false)}
            >
              <i className="bx bx-chevron-left bx-sm align-middle" />
            </button>
          </div>

          <div className="menu-inner-shadow" />

          <ul className="menu-inner py-1">
            <li className={pathname === "/" ? "menu-item active" : "menu-item"}>
              <Link href="/" className="menu-link" onClick={() => setMenuOpen(false)}>
                <i className="menu-icon tf-icons bx bx-home-circle" />
                <div>Dashboard</div>
              </Link>
            </li>
            <li className={pathname === "/profile" || pathname === "/profile/" ? "menu-item active" : "menu-item"}>
              <Link href="/profile/" className="menu-link" onClick={() => setMenuOpen(false)}>
                <i className="menu-icon tf-icons bx bx-user" />
                <div>My profile</div>
              </Link>
            </li>
            <li className={pathname === "/settings" || pathname === "/settings/" ? "menu-item active" : "menu-item"}>
              <Link href="/settings/" className="menu-link" onClick={() => setMenuOpen(false)}>
                <i className="menu-icon tf-icons bx bx-cog" />
                <div>Settings</div>
              </Link>
            </li>

            {groups.flatMap((group) => [
              <li key={`hdr-${group}`} className="menu-header small text-uppercase">
                <span className="menu-header-text">{group}</span>
              </li>,
              ...nav
                .filter((item) => item.group === group)
                .map((item) => {
                  const active = pathname === item.route;
                  const label =
                    item.migrationStatus === "LEGACY_FIREBASE"
                      ? `${item.name} (migration pending)`
                      : item.migrationStatus === "MIGRATION_IN_PROGRESS" && !item.available
                        ? `${item.name} (flag off)`
                        : item.name;
                  return (
                    <li key={item.code} className={active ? "menu-item active" : "menu-item"}>
                      <Link
                        href={item.route}
                        className="menu-link"
                        aria-current={active ? "page" : undefined}
                        onClick={() => setMenuOpen(false)}
                      >
                        <i className={`menu-icon tf-icons bx ${iconForModule(item.code, item.group)}`} />
                        <div>{label}</div>
                      </Link>
                    </li>
                  );
                }),
            ])}
          </ul>
        </aside>

        <div className="layout-page">
          <nav
            className="layout-navbar container-xxl navbar navbar-expand-xl navbar-detached align-items-center bg-navbar-theme"
            id="layout-navbar"
          >
            <div className="layout-menu-toggle navbar-nav align-items-xl-center me-3 me-xl-0 d-xl-none">
              <button
                type="button"
                className="nav-item nav-link px-0 me-xl-4 btn btn-link"
                aria-label={menuOpen ? "Close menu" : "Open menu"}
                aria-expanded={menuOpen}
                aria-controls="layout-menu"
                onClick={() => setMenuOpen((open) => !open)}
              >
                <i className="bx bx-menu bx-sm" aria-hidden="true" />
              </button>
            </div>

            <div className="navbar-nav-right d-flex align-items-center flex-wrap gap-2 w-100" id="navbar-collapse">
              <div className="navbar-nav align-items-center flex-grow-1 min-w-0 gap-2 flex-wrap">
                <label className="nav-item ind-tenant-switcher mb-0">
                  <i className="bx bx-buildings flex-shrink-0" aria-hidden="true" />
                  <span className="ind-tenant-switcher__label">Tenant</span>
                  {selectableTenants.length > 1 ? (
                    <select
                      className="form-select form-select-sm"
                      aria-label="Switch tenant"
                      value={me.tenantId ?? ""}
                      disabled={tenantSwitching}
                      onChange={(event) => void onTenantChange(event.target.value)}
                    >
                      {selectableTenants.map((t) => (
                        <option key={t.tenantId} value={t.tenantId}>
                          {t.displayName}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-muted small text-truncate" title={tenantLabel}>
                      {tenantLabel}
                    </span>
                  )}
                  {tenantSwitching ? (
                    <span className="text-muted small flex-shrink-0" role="status">
                      Switching…
                    </span>
                  ) : null}
                </label>
                <label className="nav-item ind-tenant-switcher mb-0">
                  <i className="bx bx-map flex-shrink-0" aria-hidden="true" />
                  <span className="ind-tenant-switcher__label">Facility</span>
                  <span className="text-muted small" title="Facility selector empty until catalog loads">
                    No facilities
                  </span>
                </label>
              </div>
              <ul className="navbar-nav flex-row align-items-center ms-auto flex-shrink-0">
                <li className="nav-item d-flex align-items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    title="Search not connected (MK-S18)"
                    disabled
                    aria-label="Search"
                  >
                    Search
                  </button>
                  <Link
                    href="/settings/"
                    className="btn btn-sm btn-outline-secondary text-decoration-none"
                    title="Settings"
                  >
                    Settings
                  </Link>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    title="Help center not connected"
                    disabled
                    aria-label="Help"
                  >
                    Help
                  </button>
                  <Link
                    href="/profile/"
                    className="avatar avatar-sm text-decoration-none"
                    aria-label="Open my profile"
                    title="My profile"
                  >
                    <span className="avatar-initial rounded-circle bg-label-primary">
                      {(me.isPlatformAdmin ? "PA" : me.userId.slice(0, 2)).toUpperCase()}
                    </span>
                  </Link>
                  <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => void signOut()}>
                    Sign out
                  </button>
                </li>
              </ul>
            </div>
          </nav>

          <div className="content-wrapper">
            <NetworkStatusBanner />
            <div className="container-xxl flex-grow-1 container-p-y">
              <div className="ind-content">{children}</div>
            </div>
            <footer className="content-footer footer bg-footer-theme">
              <div className="container-xxl d-flex flex-wrap justify-content-between py-2 flex-md-row flex-column">
                <div className="mb-2 mb-md-0 small text-muted">
                  © {new Date().getFullYear()} Forge Industrial Safety · {INDUSTRIAL_MODULE_REGISTRY.length}{" "}
                  modules
                  <span className="d-none d-md-inline">
                    {" "}
                    · Sneat Free theme · Firebase remains production SoT
                  </span>
                </div>
              </div>
            </footer>
          </div>
        </div>
      </div>

      {menuOpen ? (
        <button
          type="button"
          className="layout-overlay layout-menu-toggle"
          aria-label="Close navigation"
          onClick={() => setMenuOpen(false)}
        />
      ) : (
        <div className="layout-overlay layout-menu-toggle" aria-hidden="true" />
      )}
    </div>
  );
}

export function IndustrialShell({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <EnvironmentBanner environment={appEnv} />
      <ShellBody>{children}</ShellBody>
    </AuthProvider>
  );
}
