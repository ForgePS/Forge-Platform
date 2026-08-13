"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { configureApiClient } from "./api-client.js";
import { authMe, logoutAll, selectTenant, type AuthMe } from "./auth-api.js";
import {
  clearActiveTenantId,
  clearAuthStorage,
  getActiveTenantId,
  getRefreshToken,
  setActiveTenantId,
} from "./auth-storage.js";
import { buildLogoutUrl, redirectToCognitoLogin, refreshAccessToken } from "./cognito-oauth.js";
import { switchActiveTenant } from "./tenant-switch.js";
import { syncTenantIdInUrl } from "./tenant-scoped.js";

/** Max time for initial session bootstrap before surfacing a recoverable error. */
export const AUTH_BOOTSTRAP_TIMEOUT_MS = 12_000;

export type AuthContextValue = {
  me: AuthMe | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  loginWithCognito: () => Promise<void>;
  logout: () => Promise<void>;
  chooseTenant: (tenantId: string) => Promise<void>;
  signOutAll: () => Promise<void>;
  hasPermission: (code: string) => boolean;
  hasAnyPermission: (codes: string[]) => boolean;
  hasAllPermissions: (codes: string[]) => boolean;
  hasProduct: (productCode: string) => boolean;
  hasModule: (moduleCode: string) => boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function statusOf(err: unknown): number {
  return err && typeof err === "object" && "status" in err ? Number(err.status) : 0;
}

function isAbortError(err: unknown): boolean {
  return (
    (err instanceof DOMException && err.name === "AbortError") ||
    (err instanceof Error && err.name === "AbortError")
  );
}

/**
 * Restore Cognito active-tenant context. Cognito identity home tenant is not
 * sticky across requests unless clients send x-tenant-id (via getActiveTenantId).
 */
export async function resolveSession(signal?: AbortSignal): Promise<AuthMe> {
  const persisted = getActiveTenantId();
  try {
    let me = await authMe(signal ? { signal } : undefined);
    if (
      persisted &&
      me.tenantId !== persisted &&
      me.tenants.some((t) => t.tenantId === persisted && t.selectable)
    ) {
      me = await selectTenant(persisted, signal ? { signal } : undefined);
    } else if (
      persisted &&
      !me.tenants.some((t) => t.tenantId === persisted && t.selectable)
    ) {
      clearActiveTenantId();
      me = await authMe(signal ? { signal } : undefined);
    }
    return me;
  } catch (err) {
    // Never retry after 401 — expired/missing tokens must settle as unauthenticated.
    // Never retry after abort — bootstrap timeout owns the error surface.
    if (persisted && statusOf(err) !== 401 && !isAbortError(err)) {
      clearActiveTenantId();
      return authMe(signal ? { signal } : undefined);
    }
    throw err;
  }
}

function bootstrapErrorMessage(err: unknown): string {
  if (isAbortError(err)) {
    return "Session check timed out. Check your connection and try again.";
  }
  return err instanceof Error ? err.message : "Authentication failed";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<AuthMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const clearingSession = useRef(false);
  const bootstrapAbortRef = useRef<AbortController | null>(null);

  const clearSession = useCallback(() => {
    if (clearingSession.current) return;
    clearingSession.current = true;
    clearAuthStorage();
    setMe(null);
    setError(null);
    clearingSession.current = false;
  }, []);

  useEffect(() => {
    configureApiClient({ onUnauthorized: clearSession });
  }, [clearSession]);

  const refresh = useCallback(async () => {
    bootstrapAbortRef.current?.abort();
    const controller = new AbortController();
    bootstrapAbortRef.current = controller;
    const timer = window.setTimeout(() => controller.abort(), AUTH_BOOTSTRAP_TIMEOUT_MS);

    setLoading(true);
    setError(null);
    try {
      setMe(await resolveSession(controller.signal));
    } catch (err) {
      setMe(null);
      const status = statusOf(err);
      if (status !== 401 || isAbortError(err)) {
        setError(bootstrapErrorMessage(err));
      }
    } finally {
      window.clearTimeout(timer);
      if (bootstrapAbortRef.current === controller) {
        bootstrapAbortRef.current = null;
      }
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    async function bootstrap() {
      // On the OAuth callback route, skip /auth/me until exchangeCodeForTokens
      // completes — a concurrent 401-with-bearer race can clear a just-written token.
      if (typeof window !== "undefined" && window.location.pathname.includes("/auth/callback")) {
        setLoading(false);
        return;
      }

      const controller = new AbortController();
      bootstrapAbortRef.current = controller;
      const timer = window.setTimeout(() => controller.abort(), AUTH_BOOTSTRAP_TIMEOUT_MS);

      setLoading(true);
      setError(null);
      try {
        if (getRefreshToken()) {
          try {
            await refreshAccessToken({ signal: controller.signal });
          } catch (err) {
            if (isAbortError(err)) throw err;
            // Keep the existing access token — a refresh failure must not wipe a
            // just-established session (common right after OAuth code exchange).
          }
        }
        setMe(await resolveSession(controller.signal));
      } catch (err) {
        setMe(null);
        // Unauthenticated visitors (no bearer / no linked session) are expected
        // on public routes — do not surface as a blocking shell error.
        const status = statusOf(err);
        if (status !== 401 || isAbortError(err)) {
          setError(bootstrapErrorMessage(err));
        }
      } finally {
        window.clearTimeout(timer);
        if (bootstrapAbortRef.current === controller) {
          bootstrapAbortRef.current = null;
        }
        setLoading(false);
      }
    }

    void bootstrap();

    return () => {
      bootstrapAbortRef.current?.abort();
    };
  }, [clearSession]);

  const loginWithCognito = useCallback(async () => {
    setError(null);
    try {
      await redirectToCognitoLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    }
  }, []);

  const logout = useCallback(async () => {
    setError(null);
    try {
      await logoutAll();
    } catch {
      // Clear local session even when API logout fails.
    } finally {
      clearSession();
      if (typeof window !== "undefined") {
        try {
          window.location.assign(buildLogoutUrl());
        } catch {
          window.location.assign("/login/");
        }
      }
    }
  }, [clearSession]);

  const chooseTenant = useCallback(async (tenantId: string) => {
    setError(null);
    try {
      const updated = await switchActiveTenant({
        tenantId,
        previousTenantId: getActiveTenantId(),
        selectTenant,
        setActiveTenantId,
        clearActiveTenantId,
      });
      // Replace the entire AuthMe summary so prior tenant capabilities cannot linger.
      setMe(updated);
      syncTenantIdInUrl(tenantId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tenant switch failed");
      throw err;
    }
  }, []);

  const signOutAll = logout;

  const hasPermission = useCallback(
    (code: string) => {
      if (!me) return false;
      if (me.isPlatformAdmin) return true;
      return me.permissions.includes(code);
    },
    [me],
  );

  const hasAnyPermission = useCallback(
    (codes: string[]) => codes.some((code) => hasPermission(code)),
    [hasPermission],
  );

  const hasAllPermissions = useCallback(
    (codes: string[]) => codes.length > 0 && codes.every((code) => hasPermission(code)),
    [hasPermission],
  );

  const hasProduct = useCallback(
    (productCode: string) => {
      if (!me) return false;
      if (me.isPlatformAdmin) return true;
      return me.activeProducts.includes(productCode);
    },
    [me],
  );

  const hasModule = useCallback(
    (moduleCode: string) => {
      if (!me) return false;
      if (me.isPlatformAdmin) return true;
      return me.activeModules.includes(moduleCode);
    },
    [me],
  );

  const value = useMemo(
    () => ({
      me,
      loading,
      error,
      refresh,
      loginWithCognito,
      logout,
      chooseTenant,
      signOutAll,
      hasPermission,
      hasAnyPermission,
      hasAllPermissions,
      hasProduct,
      hasModule,
    }),
    [
      me,
      loading,
      error,
      refresh,
      loginWithCognito,
      logout,
      chooseTenant,
      signOutAll,
      hasPermission,
      hasAnyPermission,
      hasAllPermissions,
      hasProduct,
      hasModule,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}

export function usePermission(code: string): boolean {
  const { hasPermission } = useAuth();
  return hasPermission(code);
}

/** True when the session has at least one of the listed permission codes. */
export function useAnyPermission(codes: string[]): boolean {
  const { hasAnyPermission } = useAuth();
  return hasAnyPermission(codes);
}

/** True when the session has every listed permission code. Empty list is false. */
export function useAllPermissions(codes: string[]): boolean {
  const { hasAllPermissions } = useAuth();
  return hasAllPermissions(codes);
}

export function useProductEnabled(productCode: string): boolean {
  const { hasProduct } = useAuth();
  return hasProduct(productCode);
}

export function useModuleEnabled(moduleCode: string): boolean {
  const { hasModule } = useAuth();
  return hasModule(moduleCode);
}
