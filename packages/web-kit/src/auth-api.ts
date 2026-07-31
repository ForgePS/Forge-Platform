import { apiGet, apiSend } from "./api-client.js";

export type AuthTenant = {
  tenantId: string;
  slug: string;
  displayName: string;
  tenantStatus: string;
  membershipId: string | null;
  membershipStatus: string;
  isDefaultTenant: boolean;
  selectable: boolean;
};

export type AuthMe = {
  userId: string;
  personId: string | null;
  tenantId: string;
  organizationIds: string[];
  permissions: string[];
  activeProducts: string[];
  activeModules: string[];
  isPlatformAdmin: boolean;
  authProvider: string;
  tenants: AuthTenant[];
};

export function authMe(): Promise<AuthMe> {
  return apiGet<AuthMe>("/api/v1/auth/me");
}

export function selectTenant(tenantId: string): Promise<AuthMe> {
  return apiSend<AuthMe>("/api/v1/auth/select-tenant", "POST", { tenantId });
}

export function logoutAll(): Promise<{ sessionVersion: number }> {
  return apiSend<{ sessionVersion: number }>("/api/v1/auth/logout-all", "POST");
}

export type EffectiveFeature = {
  key: string;
  name: string;
  value: unknown;
  valueType: string;
};

export function listEffectiveFeatures(tenantId: string): Promise<EffectiveFeature[]> {
  return apiGet<EffectiveFeature[]>(`/api/v1/tenants/${tenantId}/features/effective`);
}
