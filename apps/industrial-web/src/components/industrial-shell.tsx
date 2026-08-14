"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthProvider, apiGet, useAuth } from "@forge/web-kit";
import { EnvironmentBanner } from "@forge/ui";
import { INDUSTRIAL_MODULE_REGISTRY, INDUSTRIAL_PRODUCT_CODE } from "@forge/contracts";
import { buildIndustrialNavigation, featureFlagForModule, navLabelForItem } from "@/lib/navigation";
import { clearAllOfflineData } from "@/lib/offline/cache";
import { NetworkStatusBanner } from "@/lib/offline/network-status";
import { ThemeModeToggle, useIndustrialThemeMode } from "@/components/theme-mode-toggle";
import { useLoginBranding } from "@/hooks/use-login-branding";
import { useTenantBranding } from "@/hooks/use-tenant-branding";
import { useFacilityContext } from "@/hooks/use-facility-context";
import { FieldQuickBar } from "@/components/field-quick-bar";

const appEnv = process.env.NEXT_PUBLIC_APP_ENV ?? process.env.APP_ENV ?? "local";

/** Static export uses trailingSlash — normalize for route matching. */
function normalizePath(path: string | null | undefined): string {
  if (!path) return "/";
  if (path.length > 1 && path.endsWith("/")) return path.slice(0, -1);
  return path;
}

function pathsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  return normalizePath(a) === normalizePath(b);
}

function defaultBrandMark(primaryColor = "#696cff") {
  return (
    <svg width="25" viewBox="0 0 25 42" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        fill={primaryColor}
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12.017 0 0 6.948v14.346l8.505 4.886V16.42l7.445-4.283v17.201l-3.878 2.231v4.886L24.034 28.5V6.948L12.017 0Z"
      />
    </svg>
  );
}

/** When logoUrl is set, show full logo only (no short-name text). Falls back to mark + label. */
function BrandLockup({
  logoUrl,
  label,
  primaryColor = "#696cff",
  href,
  onClick,
  textClassName = "app-brand-text demo menu-text fw-bolder ms-2",
}: {
  logoUrl?: string;
  label: string;
  primaryColor?: string;
  href?: string;
  onClick?: () => void;
  textClassName?: string;
}) {
  const [logoFailed, setLogoFailed] = useState(false);
  const showFullLogo = Boolean(logoUrl?.trim()) && !logoFailed;

  const inner = showFullLogo ? (
    <span className="app-brand-logo demo app-brand-full-logo">
      <img
        src={logoUrl}
        alt={label}
        className="app-brand-full-logo-img"
        onError={() => setLogoFailed(true)}
      />
    </span>
  ) : (
    <>
      <span className="app-brand-logo demo">{defaultBrandMark(primaryColor)}</span>
      <span className={textClassName}>{label}</span>
    </>
  );

  const linkClassName = showFullLogo ? "app-brand-link app-brand-link--full-logo" : "app-brand-link";

  if (href) {
    return (
      <Link href={href} className={linkClassName} {...(onClick ? { onClick } : {})}>
        {inner}
      </Link>
    );
  }
  return <div className={linkClassName}>{inner}</div>;
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

function iconForGroup(group: string): string {
  const g = group.toLowerCase();
  if (g.includes("overview")) return "bx-home-circle";
  if (g === "people") return "bx-group";
  if (g === "safety" && !g.includes("program")) return "bx-error";
  if (g.includes("safety program")) return "bx-error-circle";
  if (g.includes("compliance")) return "bx-check-shield";
  if (g.includes("operation")) return "bx-wrench";
  if (g.includes("communication")) return "bx-message";
  if (g.includes("reporting")) return "bx-bar-chart-alt-2";
  if (g.includes("admin")) return "bx-cog";
  if (g.includes("people") || g.includes("training")) return "bx-group";
  if (g.includes("incident") || g.includes("claim")) return "bx-error";
  if (g.includes("risk") || g.includes("prevention")) return "bx-shield";
  if (g.includes("equipment")) return "bx-wrench";
  if (g.includes("high")) return "bx-error-circle";
  if (g.includes("facility")) return "bx-buildings";
  if (g.includes("emergency")) return "bx-plus-medical";
  if (g.includes("system")) return "bx-slider-alt";
  if (g.includes("dashboard")) return "bx-home-circle";
  return "bx-folder";
}

function GateCard({
  title,
  body,
  muted,
  children,
  brandLabel = "Industrial",
  logoUrl,
  primaryColor,
}: {
  title: string;
  body: string;
  muted?: string;
  children?: ReactNode;
  brandLabel?: string;
  logoUrl?: string;
  primaryColor?: string;
}) {
  return (
    <div className="container-xxl">
      <div className="authentication-wrapper authentication-basic container-p-y">
        <div className="authentication-inner">
          <div className="card">
            <div className="card-body">
              <div className="app-brand justify-content-center mb-4">
                <BrandLockup
                  label={brandLabel}
                  textClassName="app-brand-text demo text-body fw-bolder ms-2"
                  {...(logoUrl ? { logoUrl } : {})}
                  {...(primaryColor ? { primaryColor } : {})}
                />
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
  const {
    productDisplayName,
    appShortName,
    logoUrl,
    primaryColor,
    secondaryColor,
    accentColor,
  } = useTenantBranding();
  const { login, primaryColor: loginPrimaryColor } = useLoginBranding();
  const themeMode = useIndustrialThemeMode();
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [menuOpen, setMenuOpen] = useState(false);
  /** Sneat group toggles — start collapsed; open the group that owns the current route. */
  const [openGroups, setOpenGroups] = useState<ReadonlySet<string>>(() => new Set());

  function toggleNavGroup(group: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  }

  useEffect(() => {
    if (!pathname) return;
    const current = normalizePath(pathname);
    const group =
      current === "/settings"
        ? "Administration"
        : (INDUSTRIAL_MODULE_REGISTRY.find((entry) => pathsMatch(entry.route, current))?.group ??
          null);
    if (!group) return;
    setOpenGroups((prev) => {
      if (prev.has(group)) return prev;
      const next = new Set(prev);
      next.add(group);
      return next;
    });
  }, [pathname]);

  // Dark forest brand primaries clash on dark surfaces — keep Sneat purple in dark mode.
  const brandStyle = (
    themeMode === "dark"
      ? {}
      : {
          ...(primaryColor ? { ["--bs-primary"]: primaryColor } : {}),
          ...(secondaryColor ? { ["--ind-brand-secondary"]: secondaryColor } : {}),
          ...(accentColor && !primaryColor ? { ["--bs-primary"]: accentColor } : {}),
        }
  ) as CSSProperties;

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
          flags?: Record<string, boolean>;
          modules: Array<{ code: string; awsEnabled: boolean; featureFlagKey?: string }>;
        }>("/api/v1/industrial/bootstrap");
        if (cancelled) return;
        if (boot.flags && Object.keys(boot.flags).length > 0) {
          setFlags(
            Object.fromEntries(
              Object.entries(boot.flags).map(([key, value]) => [key, Boolean(value)]),
            ),
          );
          return;
        }
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

  const { sites, facilityId, setFacilityId, selectedLabel } = useFacilityContext(tenantId);

  if (isPublicAuthRoute) {
    return <>{children}</>;
  }

  const gatePrimary = loginPrimaryColor || primaryColor || undefined;
  const gateBrand = {
    brandLabel: login.brandLabel,
    ...(login.logoUrl ? { logoUrl: login.logoUrl } : logoUrl ? { logoUrl } : {}),
    ...(gatePrimary ? { primaryColor: gatePrimary } : {}),
  };

  if (loading) {
    return <GateCard title={productDisplayName} body="Loading your session…" {...gateBrand} />;
  }

  if (error || !me) {
    return (
      <GateCard
        title={login.headline}
        body={login.body}
        muted={error ? error : login.statusText}
        {...gateBrand}
      >
        <button
          type="button"
          className="btn btn-primary d-grid w-100"
          onClick={() => void loginWithCognito()}
        >
          {login.buttonLabel}
        </button>
      </GateCard>
    );
  }

  if (!me.tenantId) {
    const selectable = me.tenants.filter((t) => t.selectable);
    return (
      <GateCard
        title="Select a tenant"
        body="Choose a tenant to continue."
        muted="No tenant selected"
        {...gateBrand}
      >
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
    const alternates = me.tenants.filter((t) => t.selectable && t.tenantId !== me.tenantId);
    return (
      <GateCard
        title="Product not entitled"
        body={`This tenant is not entitled to ${productDisplayName}.`}
        muted="Unauthorized product access"
        {...gateBrand}
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
        <button
          type="button"
          className="btn btn-outline-secondary d-grid w-100"
          onClick={() => void signOut()}
        >
          Sign out
        </button>
      </GateCard>
    );
  }

  if (!hasIndustrialAccess) {
    return (
      <GateCard
        title="Access denied"
        body={`You do not have permission to access ${productDisplayName}.`}
        muted="Missing industrial.access"
        {...gateBrand}
      />
    );
  }

  const nav = buildIndustrialNavigation({
    entitled: true,
    permissions,
    flags,
  });
  const groups = [...new Set(nav.map((n) => n.group))];
  const companyLabel =
    me.tenants.find((t) => t.tenantId === me.tenantId)?.displayName ?? "Company";

  return (
    <div className="layout-wrapper layout-content-navbar" style={brandStyle}>
      <div className="layout-container">
        <aside id="layout-menu" className="layout-menu menu-vertical menu bg-menu-theme">
          <div className="app-brand demo">
            <BrandLockup
              href="/"
              label={appShortName}
              primaryColor={primaryColor || "#696cff"}
              onClick={() => setMenuOpen(false)}
              {...(logoUrl ? { logoUrl } : {})}
            />
            <button
              type="button"
              className="layout-menu-toggle menu-link text-large ms-auto d-block d-xl-none btn btn-link p-0 border-0"
              aria-label="Close menu"
              onClick={() => setMenuOpen(false)}
            >
              <i className="bx bx-chevron-left bx-sm align-middle" />
            </button>
          </div>

          <div className="menu-inner-shadow" />

          <ul className="menu-inner py-1">
            {groups.map((group) => {
              const isOpen = openGroups.has(group);
              const childItems = nav.filter((item) => item.group === group);
              const settingsActive = group === "Administration" && pathsMatch(pathname, "/settings");
              const groupActive =
                settingsActive || childItems.some((item) => pathsMatch(pathname, item.route));

              return (
                <li
                  key={group}
                  className={`menu-item${isOpen ? " open" : ""}${groupActive ? " active" : ""}`}
                >
                  <a
                    href={`#nav-${group.replace(/\s+/g, "-").toLowerCase()}`}
                    className="menu-link menu-toggle"
                    aria-expanded={isOpen}
                    onClick={(e) => {
                      e.preventDefault();
                      toggleNavGroup(group);
                    }}
                  >
                    <i className={`menu-icon tf-icons bx ${iconForGroup(group)}`} />
                    <div>{group}</div>
                  </a>
                  <ul className="menu-sub">
                    {childItems.map((item) => {
                      const active = pathsMatch(pathname, item.route);
                      const label = navLabelForItem(item);
                      return (
                        <li
                          key={item.code}
                          className={active ? "menu-item active" : "menu-item"}
                        >
                          <Link
                            href={item.route}
                            className="menu-link"
                            aria-current={active ? "page" : undefined}
                            onClick={() => setMenuOpen(false)}
                          >
                            <i
                              className={`menu-icon tf-icons bx ${iconForModule(item.code, item.group)}`}
                            />
                            <div>{label}</div>
                          </Link>
                        </li>
                      );
                    })}
                    {group === "Administration" ? (
                      <li className={settingsActive ? "menu-item active" : "menu-item"}>
                        <Link
                          href="/settings"
                          className="menu-link"
                          aria-current={settingsActive ? "page" : undefined}
                          onClick={() => setMenuOpen(false)}
                        >
                          <i className="menu-icon tf-icons bx bx-cog" />
                          <div>Settings</div>
                        </Link>
                      </li>
                    ) : null}
                  </ul>
                </li>
              );
            })}
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
                aria-label="Open menu"
                onClick={() => setMenuOpen(true)}
              >
                <i className="bx bx-menu bx-sm" />
              </button>
            </div>

            <div className="navbar-nav-right d-flex align-items-center w-100" id="navbar-collapse">
              <div className="navbar-nav align-items-center flex-grow-1 gap-2 gap-md-3 flex-wrap py-1 ind-shell-context">
                <div className="nav-item d-flex align-items-center text-body-secondary small ind-shell-company">
                  <i className="bx bx-buildings me-2 fs-5 d-none d-sm-inline" />
                  <span className="text-truncate">
                    <span className="text-muted d-none d-sm-inline">Company:</span>{" "}
                    <span className="fw-semibold text-heading">{companyLabel}</span>
                  </span>
                </div>
                <div className="nav-item d-flex align-items-center flex-grow-1 flex-md-grow-0 ind-shell-location">
                  <label className="visually-hidden" htmlFor="ind-facility-select">
                    Location
                  </label>
                  <select
                    id="ind-facility-select"
                    className="form-select form-select-sm"
                    value={facilityId}
                    onChange={(e) => setFacilityId(e.target.value)}
                    aria-label="Location"
                  >
                    <option value="all">All Locations</option>
                    {sites.map((site) => (
                      <option key={site.id} value={site.id}>
                        {site.name}
                      </option>
                    ))}
                  </select>
                  <span className="visually-hidden">{selectedLabel}</span>
                </div>
              </div>
              <ul className="navbar-nav flex-row align-items-center ms-auto">
                <li className="nav-item navbar-dropdown dropdown-user dropdown me-2">
                  <button
                    type="button"
                    className="btn btn-sm btn-icon btn-outline-secondary"
                    aria-label="Notifications"
                    title="Notifications — coming soon"
                    disabled
                  >
                    <i className="bx bx-bell" />
                  </button>
                </li>
                <li className="nav-item d-flex align-items-center gap-2">
                  <ThemeModeToggle />
                  <span className="avatar avatar-sm d-none d-md-inline-flex">
                    <span className="avatar-initial rounded-circle bg-label-primary">
                      {me.userId.slice(0, 2).toUpperCase()}
                    </span>
                  </span>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => void signOut()}
                  >
                    Sign out
                  </button>
                </li>
              </ul>
            </div>
          </nav>

          <div className="content-wrapper">
            <NetworkStatusBanner />
            <div className="container-xxl flex-grow-1 container-p-y ind-content-pad">
              <div className="ind-content">{children}</div>
            </div>
            <footer className="content-footer footer bg-footer-theme">
              <div className="container-xxl d-flex flex-wrap justify-content-between py-2 flex-md-row flex-column">
                <div className="mb-2 mb-md-0">
                  © {new Date().getFullYear()} {productDisplayName} · {appShortName}
                </div>
              </div>
            </footer>
            <FieldQuickBar />
          </div>
        </div>
      </div>

      <div
        className="layout-overlay layout-menu-toggle"
        role="presentation"
        onClick={() => setMenuOpen(false)}
      />
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
