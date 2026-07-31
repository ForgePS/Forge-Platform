"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { EnvironmentBanner } from "@forge/ui";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import styles from "../app/shell.module.css";

const appEnv = process.env.NEXT_PUBLIC_APP_ENV ?? process.env.APP_ENV ?? "local";

const navGroups = [
  {
    label: "Overview",
    items: [
      { href: "/", label: "Dashboard" },
      { href: "/health", label: "Platform health" },
      { href: "/deployment", label: "Deployment" },
    ],
  },
  {
    label: "Access",
    items: [
      { href: "/login", label: "Login" },
      { href: "/select-tenant", label: "Select tenant" },
      { href: "/invitations", label: "Invitations" },
      { href: "/memberships", label: "Memberships" },
      { href: "/onboarding", label: "Onboarding" },
    ],
  },
  {
    label: "Platform",
    items: [
      { href: "/tenants", label: "Tenants" },
      { href: "/organizations", label: "Organizations" },
      { href: "/persons", label: "Persons" },
      { href: "/users", label: "Users" },
      { href: "/roles", label: "Roles" },
      { href: "/permissions", label: "Permissions" },
    ],
  },
  {
    label: "Catalog",
    items: [
      { href: "/products", label: "Products" },
      { href: "/entitlements", label: "Entitlements" },
      { href: "/subscriptions", label: "Subscriptions" },
      { href: "/features", label: "Feature flags" },
    ],
  },
  {
    label: "NERIS Schema",
    items: [
      { href: "/neris/packages", label: "Packages" },
      { href: "/neris/versions", label: "Versions" },
      { href: "/neris/modules", label: "Modules" },
      { href: "/neris/fields", label: "Fields" },
      { href: "/neris/value-sets", label: "Value sets" },
      { href: "/neris/conditions", label: "Conditions" },
      { href: "/neris/mappings", label: "Mappings" },
      { href: "/neris/validation", label: "Validation" },
    ],
  },
  {
    label: "Configuration Studio",
    items: [
      { href: "/studio", label: "Studio home" },
      { href: "/studio/tenant-profile", label: "Tenant Profile" },
      { href: "/studio/organization-profile", label: "Organization Profile" },
      { href: "/studio/branding", label: "Branding" },
      { href: "/studio/navigation", label: "Navigation" },
      { href: "/studio/terminology", label: "Terminology" },
      { href: "/studio/modules", label: "Modules" },
      { href: "/studio/features", label: "Features" },
      { href: "/studio/dropdowns", label: "Dropdowns" },
      { href: "/studio/custom-fields", label: "Custom fields" },
      { href: "/studio/forms", label: "Forms" },
      { href: "/studio/workflows", label: "Workflows" },
      { href: "/studio/roles", label: "Roles" },
      { href: "/studio/permissions", label: "Permissions" },
      { href: "/studio/notification-templates", label: "Notification templates" },
      { href: "/studio/email-templates", label: "Email templates" },
      { href: "/studio/document-templates", label: "Document templates" },
      { href: "/studio/certificate-templates", label: "Certificate templates" },
      { href: "/studio/dashboards", label: "Dashboards" },
      { href: "/studio/reporting", label: "Reporting" },
      { href: "/studio/import-config", label: "Import config" },
      { href: "/studio/export-config", label: "Export config" },
      { href: "/studio/security", label: "Security" },
      { href: "/studio/retention", label: "Retention" },
      { href: "/studio/business-hours", label: "Business hours" },
      { href: "/studio/holiday-calendar", label: "Holiday calendar" },
      { href: "/studio/facilities", label: "Facilities" },
      { href: "/studio/locations", label: "Locations" },
    ],
  },
  {
    label: "AI Management",
    items: [
      { href: "/ai", label: "Overview" },
      { href: "/ai/providers", label: "Providers" },
      { href: "/ai/models", label: "Models" },
      { href: "/ai/tenant-access", label: "Tenant Access" },
      { href: "/ai/feature-status", label: "Feature Status" },
      { href: "/ai/templates", label: "Templates" },
      { href: "/ai/policies", label: "Policies" },
      { href: "/ai/usage", label: "Usage" },
      { href: "/ai/audit", label: "Audit" },
    ],
  },
  {
    label: "Import Center",
    items: [
      { href: "/imports", label: "Import Center" },
    ],
  },
  {
    label: "Settings",
    items: [
      { href: "/branding", label: "Legacy branding" },
      { href: "/configuration", label: "Legacy key/value" },
      { href: "/audit", label: "Audit" },
    ],
  },
];

function ShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { me, loading, error, signOutAll } = useAuth();

  return (
    <>
      <EnvironmentBanner environment={appEnv} />
      <div className={styles.shell}>
        <aside className={styles.nav} aria-label="Primary">
          <p className={styles.brand}>Forge Creator</p>
          {!loading && me ? (
            <div className={styles.session}>
              <p className={styles.sessionLabel}>Signed in</p>
              <p className={styles.sessionValue}>{me.userId.slice(0, 8)}…</p>
              <p className={styles.sessionLabel}>Tenant</p>
              <p className={styles.sessionValue}>{me.tenantId.slice(0, 8)}…</p>
              <button type="button" className={styles.signOut} onClick={() => void signOutAll()}>
                Sign out all
              </button>
            </div>
          ) : null}
          {!loading && error ? <p className={styles.authError}>{error}</p> : null}
          {navGroups.map((group) => (
            <div key={group.label} className={styles.navGroup}>
              <p className={styles.navGroupLabel}>{group.label}</p>
              <nav>
                {group.items.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={active ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink}
                      aria-current={active ? "page" : undefined}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
          ))}
        </aside>
        <main className={styles.main}>{children}</main>
      </div>
    </>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ShellInner>{children}</ShellInner>
    </AuthProvider>
  );
}
