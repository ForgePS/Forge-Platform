"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { EnvironmentBanner } from "@forge/ui";
import { useAuth, useFeatureFlags } from "@forge/web-kit";
import { RMS_FEATURE_FLAGS } from "@/lib/constants";
import pageStyles from "../../app/page.module.css";
import styles from "../../app/shell.module.css";

const appEnv = process.env.NEXT_PUBLIC_APP_ENV ?? process.env.APP_ENV ?? "local";

const recordsNav = [
  { href: "/incidents/", label: "Incidents", flag: "incidentShell" as const },
  { href: "/incidents/new/", label: "New Incident", flag: "manualIntake" as const },
  { href: "/review/", label: "Review", flag: "officerReview" as const },
];

const operationsNav = [
  { href: "/cad/operations/", label: "CAD Operations", flag: "cadOperations" as const },
  { href: "/cad/conflicts/", label: "CAD Conflicts", flag: "cadEnabled" as const },
  { href: "/cad/messages/", label: "CAD Messages", flag: "cadOperations" as const },
];

const configurationNav = [
  { href: "/configuration/", label: "NERIS Configuration", flag: "tenantConfiguration" as const },
  { href: "/cad/connections/", label: "CAD Connections", flag: "cadEnabled" as const },
  { href: "/cad/unmapped/", label: "CAD Unmapped", flag: "cadEnabled" as const },
  { href: "/cad/mappings/", label: "CAD Unit / Personnel", flag: "cadEnabled" as const },
];

function NavGroup({
  label,
  items,
  pathname,
  flags,
}: {
  label: string;
  items: Array<{ href: string; label: string; flag: keyof typeof RMS_FEATURE_FLAGS }>;
  pathname: string;
  flags: Record<string, boolean | undefined>;
}) {
  const visible = items.filter((item) => flags[RMS_FEATURE_FLAGS[item.flag]]);
  if (visible.length === 0) return null;
  return (
    <nav className={styles.navGroup}>
      <p className={styles.navGroupLabel}>{label}</p>
      {visible.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href.replace(/\/$/, ""));
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
  );
}

/** Unmodified legacy shell presentation — retirement only after FX shell acceptance. */
export function RmsLegacyShellAdapter({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { me, loading, error, logout } = useAuth();
  const { flags } = useFeatureFlags(Object.values(RMS_FEATURE_FLAGS));
  const [navOpen, setNavOpen] = useState(false);

  return (
    <>
      <EnvironmentBanner environment={appEnv} />
      <div
        className={navOpen ? styles.shell : `${styles.shell} ${styles.navCollapsed}`}
        data-rms-shell="legacy"
        data-testid="rms-legacy-shell"
      >
        <aside className={styles.nav} aria-label="Primary">
          <p className={styles.brand}>Forge RMS</p>
          {!loading && me ? (
            <div className={styles.session}>
              <p className={styles.sessionLabel}>Signed in</p>
              <p className={styles.sessionValue}>{me.userId.slice(0, 8)}…</p>
              <p className={styles.sessionLabel}>Tenant</p>
              <p className={styles.sessionValue}>{me.tenantId.slice(0, 8)}…</p>
              <Link href="/select-tenant/" className={pageStyles.muted}>
                Switch tenant
              </Link>
              <button type="button" className={styles.signOut} onClick={() => void logout()}>
                Sign out
              </button>
            </div>
          ) : (
            <p className={pageStyles.muted}>
              <Link href="/login/">Sign in</Link>
            </p>
          )}
          {!loading && error ? <p className={styles.authError}>{error}</p> : null}
          <NavGroup label="Records" items={recordsNav} pathname={pathname} flags={flags} />
          <NavGroup label="Operations" items={operationsNav} pathname={pathname} flags={flags} />
          <NavGroup
            label="Configuration"
            items={configurationNav}
            pathname={pathname}
            flags={flags}
          />
          <nav className={styles.navGroup}>
            <Link
              href="/"
              className={
                pathname === "/" ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink
              }
            >
              Home
            </Link>
          </nav>
        </aside>
        <main className={styles.main}>
          <button
            type="button"
            className={`${pageStyles.buttonSecondary} ${styles.mobileNavToggle}`}
            onClick={() => setNavOpen((open) => !open)}
          >
            {navOpen ? "Hide menu" : "Menu"}
          </button>
          {children}
        </main>
      </div>
    </>
  );
}
