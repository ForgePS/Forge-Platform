"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { filterNavigationGroups } from "@forge/design-system";
import {
  EnvironmentBanner,
  ForgeAppShell,
  ForgeNotificationMenu,
  ForgeUserMenu,
} from "@forge/ui";
import { useAuth } from "@/hooks/use-auth";
import { TENANT_ADMIN_NAV_GROUPS } from "@/lib/navigation";
import styles from "../app/shell.module.css";

const appEnv = process.env.NEXT_PUBLIC_APP_ENV ?? process.env.APP_ENV ?? "local";

export function ShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const { me, loading, error, signOutAll } = useAuth();

  const groups = filterNavigationGroups(TENANT_ADMIN_NAV_GROUPS, {
    permissions: me?.permissions ?? [],
    products: me?.activeProducts ?? [],
    ...(me?.isPlatformAdmin ? { isPlatformAdmin: true } : {}),
  });

  return (
    <ForgeAppShell
      brand="Forge Tenant Admin"
      brandMark="TA"
      productLabel="Tenant console"
      groups={groups}
      activePath={pathname}
      envBanner={<EnvironmentBanner environment={appEnv} />}
      renderLink={({ href, className, children: linkChildren, "aria-current": ariaCurrent, onClick }) => {
        const props: {
          href: string;
          className?: string;
          "aria-current"?: "page";
          onClick?: () => void;
          children: React.ReactNode;
        } = { href, children: linkChildren };
        if (className) props.className = className;
        if (ariaCurrent) props["aria-current"] = ariaCurrent;
        if (onClick) props.onClick = onClick;
        return <Link {...props} />;
      }}
      session={
        !loading && me ? (
          <>
            <p style={{ margin: 0, color: "var(--forge-color-muted)", fontSize: "var(--forge-text-xs)" }}>
              Signed in
            </p>
            <p style={{ margin: "0.15rem 0 0.5rem", fontWeight: 600 }}>{me.userId.slice(0, 8)}…</p>
            <p style={{ margin: 0, color: "var(--forge-color-muted)", fontSize: "var(--forge-text-xs)" }}>
              Tenant
            </p>
            <p style={{ margin: "0.15rem 0 0", fontWeight: 600 }}>{me.tenantId.slice(0, 8)}…</p>
          </>
        ) : error ? (
          <p className={styles.authError}>{error}</p>
        ) : null
      }
      topbarCenter={<span>Tenant Admin</span>}
      topbarRight={
        <>
          <ForgeNotificationMenu />
          {me ? (
            <ForgeUserMenu label="Signed in" onSignOut={() => void signOutAll()} />
          ) : null}
        </>
      }
    >
      {children}
    </ForgeAppShell>
  );
}
