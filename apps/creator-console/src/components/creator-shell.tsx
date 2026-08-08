"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { filterNavigationGroups } from "@forge/design-system";
import { EnvironmentBanner } from "@forge/ui";
import { useAuth } from "@forge/web-kit";
import { CreatorNotifications } from "@/components/creator-notifications";
import { ThemeModeToggle } from "@/components/theme-mode-toggle";
import { CREATOR_NAV_GROUPS } from "@/lib/navigation";

const appEnv = process.env.NEXT_PUBLIC_APP_ENV ?? process.env.APP_ENV ?? "local";
/** Optional full logo (replaces mark + "Creator" when set and loads). */
const creatorLogoUrl = process.env.NEXT_PUBLIC_CREATOR_LOGO_URL?.trim() || "";

function defaultBrandMark() {
  return (
    <svg width="25" viewBox="0 0 25 42" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        fill="#696cff"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12.017 0 0 6.948v14.346l8.505 4.886V16.42l7.445-4.283v17.201l-3.878 2.231v4.886L24.034 28.5V6.948L12.017 0Z"
      />
    </svg>
  );
}

function BrandLockup({
  label,
  logoUrl,
  onClick,
}: {
  label: string;
  logoUrl?: string;
  onClick?: () => void;
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
      <span className="app-brand-logo demo">{defaultBrandMark()}</span>
      <span className="app-brand-text demo menu-text fw-bolder ms-2">{label}</span>
    </>
  );

  return (
    <Link href="/" className="app-brand-link" {...(onClick ? { onClick } : {})}>
      {inner}
    </Link>
  );
}

function iconForRoute(route: string, groupId: string): string {
  const r = route.toLowerCase();
  if (r === "/" || r.includes("dashboard")) return "bx-home-circle";
  if (r.includes("health") || r.includes("deployment")) return "bx-pulse";
  if (r.includes("migration")) return "bx-transfer";
  if (r.includes("login") || r.includes("select-tenant")) return "bx-log-in";
  if (r.includes("invitation")) return "bx-envelope";
  if (r.includes("membership")) return "bx-id-card";
  if (r.includes("onboard")) return "bx-user-plus";
  if (r.includes("tenant")) return "bx-buildings";
  if (r.includes("organization")) return "bx-sitemap";
  if (r.includes("person")) return "bx-user";
  if (r.includes("user")) return "bx-group";
  if (r.includes("role")) return "bx-shield";
  if (r.includes("permission")) return "bx-lock-alt";
  if (r.includes("product") || r.includes("entitlement") || r.includes("subscription"))
    return "bx-package";
  if (r.includes("feature")) return "bx-flag";
  if (r.includes("neris")) return "bx-data";
  if (r.includes("studio") || r.includes("branding") || r.includes("configuration"))
    return "bx-palette";
  if (r.includes("ai")) return "bx-brain";
  if (r.includes("import")) return "bx-import";
  if (r.includes("audit")) return "bx-history";
  if (groupId === "studio") return "bx-cog";
  if (groupId === "ai") return "bx-bot";
  return "bx-circle";
}

function pathActive(pathname: string, route: string): boolean {
  if (route === "/") return pathname === "/";
  return pathname === route || pathname.startsWith(`${route}/`);
}

export function CreatorShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const { me, loading, error, logout, chooseTenant } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const groups = filterNavigationGroups(CREATOR_NAV_GROUPS, {
    permissions: me?.permissions ?? [],
    products: me?.activeProducts ?? [],
    ...(me?.isPlatformAdmin ? { isPlatformAdmin: true } : {}),
  });

  const tenants =
    me?.tenants.map((t) => ({
      tenantId: t.tenantId,
      displayName: t.displayName,
      selectable: t.selectable,
    })) ?? [];

  const activeTenantLabel =
    tenants.find((t) => t.tenantId === me?.tenantId)?.displayName ?? me?.tenantId ?? "—";

  useEffect(() => {
    document.documentElement.classList.toggle("layout-menu-expanded", menuOpen);
  }, [menuOpen]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <>
      <EnvironmentBanner environment={appEnv} />
      <div className="layout-wrapper layout-content-navbar">
        <div className="layout-container">
          <aside id="layout-menu" className="layout-menu menu-vertical menu bg-menu-theme">
            <div className="app-brand demo">
              <BrandLockup
                label="Creator"
                onClick={() => setMenuOpen(false)}
                {...(creatorLogoUrl ? { logoUrl: creatorLogoUrl } : {})}
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
              {groups.flatMap((group) => [
                <li key={`hdr-${group.id}`} className="menu-header small text-uppercase">
                  <span className="menu-header-text">{group.label}</span>
                </li>,
                ...group.items.map((item) => {
                  const active = pathActive(pathname, item.route);
                  return (
                    <li key={item.id} className={active ? "menu-item active" : "menu-item"}>
                      <Link
                        href={item.route}
                        className="menu-link"
                        aria-current={active ? "page" : undefined}
                        onClick={() => setMenuOpen(false)}
                      >
                        <i
                          className={`menu-icon tf-icons bx ${iconForRoute(item.route, group.id)}`}
                        />
                        <div>{item.label}</div>
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
                  aria-label="Open menu"
                  onClick={() => setMenuOpen(true)}
                >
                  <i className="bx bx-menu bx-sm" />
                </button>
              </div>

              <div className="navbar-nav-right d-flex align-items-center w-100" id="navbar-collapse">
                <div className="navbar-nav align-items-center flex-grow-1">
                  <div className="nav-item d-flex align-items-center text-body-secondary small">
                    <i className="bx bx-buildings me-2 fs-5" />
                    <span>
                      <span className="text-muted">Tenant:</span>{" "}
                      <span className="fw-semibold text-heading">{activeTenantLabel}</span>
                    </span>
                  </div>
                </div>
                <ul className="navbar-nav flex-row align-items-center ms-auto gap-2">
                  {me && tenants.length > 1 ? (
                    <li className="nav-item">
                      <select
                        className="form-select form-select-sm"
                        aria-label="Switch tenant"
                        value={me.tenantId ?? ""}
                        onChange={(e) => void chooseTenant(e.target.value)}
                      >
                        {tenants
                          .filter((t) => t.selectable)
                          .map((t) => (
                            <option key={t.tenantId} value={t.tenantId}>
                              {t.displayName}
                            </option>
                          ))}
                      </select>
                    </li>
                  ) : null}
                  <li className="nav-item d-flex align-items-center">
                    <CreatorNotifications />
                  </li>
                  <li className="nav-item d-flex align-items-center gap-2">
                    <ThemeModeToggle />
                    {me ? (
                      <>
                        <Link
                          href="/profile/"
                          className="avatar avatar-sm d-none d-md-inline-flex text-decoration-none"
                          aria-label="Open my profile"
                          title="My profile"
                        >
                          <span className="avatar-initial rounded-circle bg-label-primary">
                            {(me.isPlatformAdmin ? "PA" : me.userId.slice(0, 2)).toUpperCase()}
                          </span>
                        </Link>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => void logout()}
                        >
                          Sign out
                        </button>
                      </>
                    ) : loading ? (
                      <span className="text-muted small">Loading…</span>
                    ) : error ? (
                      <span className="text-danger small">{error}</span>
                    ) : null}
                  </li>
                </ul>
              </div>
            </nav>

            <div className="content-wrapper">
              <div className="container-xxl flex-grow-1 container-p-y">
                <div className="creator-content">{children}</div>
              </div>
              <footer className="content-footer footer bg-footer-theme">
                <div className="container-xxl d-flex flex-wrap justify-content-between py-2 flex-md-row flex-column">
                  <div className="mb-2 mb-md-0">
                    © {new Date().getFullYear()} Forge Creator Console · Control plane
                  </div>
                </div>
              </footer>
            </div>
          </div>
        </div>

        <div
          className="layout-overlay layout-menu-toggle"
          onClick={() => setMenuOpen(false)}
          onKeyDown={() => undefined}
          role="presentation"
        />
      </div>
    </>
  );
}
