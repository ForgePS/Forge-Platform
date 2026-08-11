"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ForgeLinkRender } from "@forge/ui";
import {
  EnvironmentBanner,
  ForgeAppShell,
  ForgeFacilitySelector,
  ForgeHelpMenu,
  ForgeProductSwitcher,
  ForgeSearchTrigger,
  ForgeShellState,
  ForgeTenantSwitcher,
  ForgeUserMenu,
} from "@forge/ui";
import { filterNavigationForSession, useAuth } from "@forge/web-kit";
import { ConnectedNotificationMenu } from "@/components/connected-notification-menu";
import { CREATOR_NAV_GROUPS } from "@/lib/navigation";
import styles from "../app/shell.module.css";

const appEnv = process.env.NEXT_PUBLIC_APP_ENV ?? process.env.APP_ENV ?? "local";

export function ShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const { me, loading, error, logout, chooseTenant } = useAuth();

  const groups = filterNavigationForSession(CREATOR_NAV_GROUPS, me);

  const tenants =
    me?.tenants.map((t) => ({
      tenantId: t.tenantId,
      displayName: t.displayName,
      selectable: t.selectable,
    })) ?? [];

  const products =
    me?.activeProducts.map((code) => ({
      id: code,
      name: code,
    })) ?? [];

  const activeTenantLabel =
    tenants.find((t) => t.tenantId === me?.tenantId)?.displayName ?? me?.tenantId ?? "—";

  const renderLink: ForgeLinkRender = ({ href, className, children: linkChildren, "aria-current": ariaCurrent, onClick }) => {
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
  };

  return (
    <ForgeAppShell
      brand="Forge Creator"
      brandMark="FC"
      productLabel="Control plane"
      groups={groups}
      activePath={pathname}
      envBanner={<EnvironmentBanner environment={appEnv} />}
      renderLink={renderLink}
      session={
        loading ? (
          <ForgeShellState state="loading" title="Loading session…" />
        ) : me ? (
          <>
            <p style={{ margin: 0, color: "var(--forge-color-muted)", fontSize: "var(--forge-text-xs)" }}>
              Signed in
            </p>
            <p style={{ margin: "0.15rem 0 0.5rem", fontWeight: 600 }}>{me.userId.slice(0, 8)}…</p>
            <p style={{ margin: 0, color: "var(--forge-color-muted)", fontSize: "var(--forge-text-xs)" }}>
              Tenant
            </p>
            <p style={{ margin: "0.15rem 0 0", fontWeight: 600 }}>{activeTenantLabel}</p>
          </>
        ) : error ? (
          <p className={styles.authError}>{error}</p>
        ) : (
          <ForgeShellState state="empty" title="Not signed in" description="Sign in to manage tenants." />
        )
      }
      topbarCenter={<span>Creator Console · {activeTenantLabel}</span>}
      topbarRight={
        <>
          <ForgeSearchTrigger />
          {me ? (
            <ForgeProductSwitcher
              products={products}
              {...(products[0]?.id ? { activeProductId: products[0].id } : {})}
              state={products.length === 0 ? "empty" : "ready"}
            />
          ) : null}
          <ForgeFacilitySelector facilities={[]} state={me ? "empty" : "unauthorized"} />
          {me ? (
            <ForgeTenantSwitcher
              tenants={tenants}
              activeTenantId={me.tenantId}
              onSelect={(id) => void chooseTenant(id)}
              disabled={tenants.filter((t) => t.selectable !== false).length <= 1}
              state={tenants.length === 0 ? "empty" : "ready"}
            />
          ) : null}
          <ForgeHelpMenu href="/profile/" renderLink={renderLink} label="Help" />
          <ConnectedNotificationMenu viewAllHref="/notifications/" renderLink={renderLink} />
          {me ? (
            <ForgeUserMenu
              label={me.isPlatformAdmin ? "Platform admin" : "Signed in"}
              onSignOut={() => void logout()}
              renderLink={renderLink}
              items={[
                { label: "Profile", href: "/profile/" },
                { label: "Settings", href: "/studio/tenant-profile/" },
              ]}
            />
          ) : null}
        </>
      }
    >
      {children}
    </ForgeAppShell>
  );
}
