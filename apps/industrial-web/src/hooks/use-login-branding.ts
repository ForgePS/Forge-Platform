"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@forge/web-kit";
import { useTenantBranding, type TenantBranding } from "./use-tenant-branding";

export type ResolvedLoginBranding = {
  logoUrl: string;
  brandLabel: string;
  headline: string;
  body: string;
  statusText: string;
  buttonLabel: string;
};

const DEFAULT_LOGIN: ResolvedLoginBranding = {
  brandLabel: "Industrial",
  headline: "Welcome to Forge Industrial Safety",
  body: "Sign in is required to continue.",
  statusText: "Unauthenticated",
  buttonLabel: "Sign in",
  logoUrl: "",
};

function resolveLoginBranding(branding: TenantBranding | null | undefined): ResolvedLoginBranding {
  const login = branding?.login;
  const product = branding?.productDisplayName?.trim();
  const legacyHeadline = product ? `Welcome to ${product}` : DEFAULT_LOGIN.headline;
  return {
    logoUrl: login?.logoUrl?.trim() || branding?.logoUrl?.trim() || DEFAULT_LOGIN.logoUrl,
    brandLabel:
      login?.brandLabel?.trim() || branding?.loginShortName?.trim() || DEFAULT_LOGIN.brandLabel,
    headline: login?.headline?.trim() || legacyHeadline,
    body: login?.body?.trim() || DEFAULT_LOGIN.body,
    statusText: login?.statusText?.trim() || DEFAULT_LOGIN.statusText,
    buttonLabel: login?.buttonLabel?.trim() || DEFAULT_LOGIN.buttonLabel,
  };
}

type PublicLoginBrandingResponse = {
  tenantId: string;
  host: string;
  logoUrl?: string;
  primaryColor?: string;
  login: ResolvedLoginBranding;
};

type ApiEnvelope<T> = { data: T };

function apiBase(): string {
  return (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");
}

/**
 * Sign-in / gate branding: host lookup pre-auth, authenticated tenant branding post-auth.
 * Kept browser-local (no @forge/configuration) so Next static export stays free of node:crypto.
 */
export function useLoginBranding() {
  const { me } = useAuth();
  const tenant = useTenantBranding();
  const [hostLogin, setHostLogin] = useState<ResolvedLoginBranding | null>(null);
  const [hostPrimaryColor, setHostPrimaryColor] = useState("");
  const [loadingHost, setLoadingHost] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (me?.tenantId) {
      setLoadingHost(false);
      return;
    }
    let cancelled = false;
    const host = window.location.hostname;
    void (async () => {
      setLoadingHost(true);
      try {
        const res = await fetch(
          `${apiBase()}/api/v1/public/login-branding?host=${encodeURIComponent(host)}`,
          { credentials: "omit" },
        );
        if (!res.ok) {
          if (!cancelled) setHostLogin(null);
          return;
        }
        const json = (await res.json()) as ApiEnvelope<PublicLoginBrandingResponse>;
        if (cancelled) return;
        setHostLogin(json.data.login);
        setHostPrimaryColor(json.data.primaryColor?.trim() || "");
      } catch {
        if (!cancelled) setHostLogin(null);
      } finally {
        if (!cancelled) setLoadingHost(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [me?.tenantId]);

  const login: ResolvedLoginBranding = me?.tenantId
    ? resolveLoginBranding(tenant.branding)
    : (hostLogin ?? resolveLoginBranding(undefined));

  const primaryColor = me?.tenantId
    ? tenant.primaryColor
    : hostPrimaryColor || tenant.primaryColor;

  return {
    loading: me?.tenantId ? tenant.loading : loadingHost,
    login,
    primaryColor,
    productDisplayName: tenant.productDisplayName,
    appShortName: tenant.appShortName,
    logoUrl: tenant.logoUrl,
    secondaryColor: tenant.secondaryColor,
    accentColor: tenant.accentColor,
  };
}
