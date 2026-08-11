"use client";

import { useEffect, useState } from "react";
import { apiGet, useAuth } from "@forge/web-kit";

export type TenantBranding = {
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  logoUrl?: string;
  productDisplayName?: string;
  appShortName?: string;
  loginShortName?: string;
  login?: {
    logoUrl?: string;
    brandLabel?: string;
    headline?: string;
    body?: string;
    statusText?: string;
    buttonLabel?: string;
  };
  emailFromName?: string;
  emailFromAddress?: string;
  customCss?: string;
};

type EffectiveResponse = {
  payload: TenantBranding | null;
  source?: string;
};

export const DEFAULT_INDUSTRIAL_BRANDING: Required<
  Pick<
    TenantBranding,
    "productDisplayName" | "appShortName" | "loginShortName"
  >
> = {
  productDisplayName: "Forge Industrial Safety",
  appShortName: "Forge Industrial",
  loginShortName: "Forge Industrial",
};

/**
 * Loads published Configuration Studio branding for the active tenant.
 * Falls back to Industrial defaults when unset or unavailable.
 */
export function useTenantBranding() {
  const { me } = useAuth();
  const [branding, setBranding] = useState<TenantBranding>({});
  const [loading, setLoading] = useState(Boolean(me?.tenantId));

  useEffect(() => {
    const tenantId = me?.tenantId;
    if (!tenantId) {
      setBranding({});
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const result = await apiGet<EffectiveResponse>(
          `/api/v1/tenants/${tenantId}/config/branding/default/effective`,
        );
        if (!cancelled) setBranding(result.payload ?? {});
      } catch {
        if (!cancelled) setBranding({});
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [me?.tenantId]);

  const productDisplayName =
    branding.productDisplayName?.trim() || DEFAULT_INDUSTRIAL_BRANDING.productDisplayName;
  const appShortName = branding.appShortName?.trim() || DEFAULT_INDUSTRIAL_BRANDING.appShortName;
  const loginShortName =
    branding.loginShortName?.trim() || DEFAULT_INDUSTRIAL_BRANDING.loginShortName;
  const logoUrl = branding.logoUrl?.trim() || "";

  return {
    loading,
    branding,
    productDisplayName,
    appShortName,
    loginShortName,
    logoUrl,
    primaryColor: branding.primaryColor?.trim() || "",
    secondaryColor: branding.secondaryColor?.trim() || "",
    accentColor: branding.accentColor?.trim() || "",
  };
}
