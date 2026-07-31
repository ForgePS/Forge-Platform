"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { EnvironmentBanner } from "@forge/ui";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import styles from "../app/shell.module.css";

const appEnv = process.env.NEXT_PUBLIC_APP_ENV ?? process.env.APP_ENV ?? "local";

const navGroups = [
  {
    label: "Import Center",
    items: [{ href: "/imports", label: "Import Center" }],
  },
  {
    label: "Configuration Studio",
    items: [
      { href: "/studio", label: "Studio home" },
      { href: "/studio/tenant-profile", label: "Tenant Profile" },
      { href: "/studio/organization-profile", label: "Org Profile" },
      { href: "/studio/branding", label: "Branding" },
      { href: "/studio/navigation", label: "Navigation" },
      { href: "/studio/terminology", label: "Terminology" },
      { href: "/studio/dropdowns", label: "Dropdowns" },
      { href: "/studio/notification-templates", label: "Notification templates" },
      { href: "/studio/email-templates", label: "Email templates" },
      { href: "/studio/business-hours", label: "Business hours" },
      { href: "/studio/holiday-calendar", label: "Holiday calendar" },
      { href: "/studio/facilities", label: "Facilities" },
      { href: "/studio/locations", label: "Locations" },
      { href: "/studio/roles", label: "Roles" },
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
          <p className={styles.brand}>
            <Link href="/" className={styles.brandLink}>
              Forge Tenant Admin
            </Link>
          </p>
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
                  const active = pathname === item.href || pathname === `${item.href}/`;
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
