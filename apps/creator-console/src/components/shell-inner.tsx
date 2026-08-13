"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { filterNavigationGroups } from "@forge/design-system";
import {
  EnvironmentBanner,
  ForgeAppShell,
  ForgeTenantSwitcher,
  ForgeUserMenu,
} from "@forge/ui";
import { useAuth } from "@forge/web-kit";
import { CreatorNotifications } from "@/components/creator-notifications";
import { CREATOR_NAV_GROUPS } from "@/lib/navigation";
import {
  clearSupportSession,
  getSupportSession,
  listenSupportSession,
  type SupportSession,
} from "@/lib/support-session";
import styles from "../app/shell.module.css";

const appEnv = process.env.NEXT_PUBLIC_APP_ENV ?? process.env.APP_ENV ?? "local";

export function ShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const { me, loading, error, logout, chooseTenant } = useAuth();
  const [supportSession, setSupportSessionState] = useState<SupportSession | null>(null);

  useEffect(() => {
    setSupportSessionState(getSupportSession());
    return listenSupportSession(setSupportSessionState);
  }, []);

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

  function endSupportSession() {
    clearSupportSession();
    setSupportSessionState(null);
    window.location.reload();
  }

  return (
    <ForgeAppShell
      brand="Forge Creator"
      brandMark="FC"
      productLabel="Control plane"
      groups={groups}
      activePath={pathname}
      envBanner={<EnvironmentBanner environment={appEnv} />}
      renderLink={({
        href,
        className,
        children: linkChildren,
        "aria-current": ariaCurrent,
        onClick,
      }) => {
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
            <p
              style={{
                margin: 0,
                color: "var(--forge-color-muted)",
                fontSize: "var(--forge-text-xs)",
              }}
            >
              Signed in
            </p>
            <p style={{ margin: "0.15rem 0 0.5rem", fontWeight: 600 }}>{me.userId.slice(0, 8)}…</p>
            <p
              style={{
                margin: 0,
                color: "var(--forge-color-muted)",
                fontSize: "var(--forge-text-xs)",
              }}
            >
              Tenant
            </p>
            <p style={{ margin: "0.15rem 0 0", fontWeight: 600 }}>{activeTenantLabel}</p>
          </>
        ) : error ? (
          <p className={styles.authError}>{error}</p>
        ) : null
      }
      topbarCenter={<span>Creator Console · {activeTenantLabel}</span>}
      topbarRight={
        <>
          {me && tenants.length > 1 ? (
            <ForgeTenantSwitcher
              tenants={tenants}
              activeTenantId={me.tenantId}
              onSelect={(id) => void chooseTenant(id)}
            />
          ) : null}
          <CreatorNotifications />
          {me ? (
            <ForgeUserMenu
              label={me.isPlatformAdmin ? "Platform admin" : "Signed in"}
              onSignOut={() => void logout()}
            />
          ) : null}
        </>
      }
    >
      {supportSession ? (
        <div className={styles.supportBanner} role="status">
          <span>
            SUPPORT SESSION · Viewing: <strong>{supportSession.customerName}</strong> ·{" "}
            {supportSession.product}
          </span>
          <button type="button" className="forge-btn forge-btn--outline" onClick={endSupportSession}>
            End Session
          </button>
        </div>
      ) : null}
      {children}
    </ForgeAppShell>
  );
}
