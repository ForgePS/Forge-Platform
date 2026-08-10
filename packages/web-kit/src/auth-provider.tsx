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
};

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Restore Cognito active-tenant context. Cognito identity home tenant is not
 * sticky across requests unless clients send x-tenant-id (via getActiveTenantId).
 */
async function resolveSession(): Promise<AuthMe> {
  const persisted = getActiveTenantId();
  try {
    let me = await authMe();
    if (
      persisted &&
      me.tenantId !== persisted &&
      me.tenants.some((t) => t.tenantId === persisted && t.selectable)
    ) {
      me = await selectTenant(persisted);
    } else if (
      persisted &&
      !me.tenants.some((t) => t.tenantId === persisted && t.selectable)
    ) {
      clearActiveTenantId();
      me = await authMe();
    }
    return me;
  } catch (err) {
    if (persisted) {
      clearActiveTenantId();
      return authMe();
    }
    throw err;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<AuthMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const clearingSession = useRef(false);

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
    setLoading(true);
    setError(null);
    try {
      setMe(await resolveSession());
    } catch (err) {
      setMe(null);
      const status = err && typeof err === "object" && "status" in err ? Number(err.status) : 0;
      if (status !== 401) {
        setError(err instanceof Error ? err.message : "Authentication failed");
      }
    } finally {
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

      setLoading(true);
      setError(null);
      try {
        if (getRefreshToken()) {
          try {
            await refreshAccessToken();
          } catch {
            // Keep the existing access token — a refresh failure must not wipe a
            // just-established session (common right after OAuth code exchange).
          }
        }
        setMe(await resolveSession());
      } catch (err) {
        setMe(null);
        // Unauthenticated visitors (no bearer / no linked session) are expected
        // on public routes — do not surface as a blocking shell error.
        const status = err && typeof err === "object" && "status" in err ? Number(err.status) : 0;
        if (status !== 401) {
          setError(err instanceof Error ? err.message : "Authentication failed");
        }
      } finally {
        setLoading(false);
      }
    }

    void bootstrap();
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
    }),
    [me, loading, error, refresh, loginWithCognito, logout, chooseTenant, signOutAll, hasPermission],
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
