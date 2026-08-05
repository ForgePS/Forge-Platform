import { assertAccessTokenShape } from "./access-token.js";

const DEV_PRINCIPAL_KEY = "forge-dev-principal";
const BEARER_TOKEN_KEY = "forge-bearer-token";
const REFRESH_TOKEN_KEY = "forge-refresh-token";
/** Last tenant chosen via select-tenant — sent as x-tenant-id for Cognito sessions. */
const ACTIVE_TENANT_KEY = "forge-active-tenant-id";

export type DevPrincipal = {
  userId: string;
  tenantId: string;
};

export function getDevPrincipal(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(DEV_PRINCIPAL_KEY);
}

export function setDevPrincipal(value: DevPrincipal): void {
  localStorage.setItem(DEV_PRINCIPAL_KEY, JSON.stringify(value));
}

export function clearDevPrincipal(): void {
  localStorage.removeItem(DEV_PRINCIPAL_KEY);
}

export function getBearerToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(BEARER_TOKEN_KEY);
}

/**
 * Persist a Cognito access_token only. JWKS documents and non-JWT payloads are rejected.
 */
export function setBearerToken(token: string): void {
  localStorage.setItem(BEARER_TOKEN_KEY, assertAccessTokenShape(token));
}

export function clearBearerToken(): void {
  localStorage.removeItem(BEARER_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setRefreshToken(token: string): void {
  localStorage.setItem(REFRESH_TOKEN_KEY, token);
}

export function clearRefreshToken(): void {
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function getActiveTenantId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_TENANT_KEY);
}

export function setActiveTenantId(tenantId: string): void {
  localStorage.setItem(ACTIVE_TENANT_KEY, tenantId);
}

export function clearActiveTenantId(): void {
  localStorage.removeItem(ACTIVE_TENANT_KEY);
}

export function clearAuthStorage(): void {
  clearDevPrincipal();
  clearBearerToken();
  clearRefreshToken();
  clearActiveTenantId();
}

export function parseDevPrincipal(raw: string): DevPrincipal | null {
  try {
    const parsed = JSON.parse(raw) as Partial<DevPrincipal>;
    if (parsed.userId && parsed.tenantId) {
      return { userId: parsed.userId, tenantId: parsed.tenantId };
    }
    return null;
  } catch {
    return null;
  }
}
