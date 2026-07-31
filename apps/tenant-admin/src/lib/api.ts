import { getBearerToken, getDevPrincipal } from "./auth-storage";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type ApiSuccess<T> = {
  data: T;
  meta: {
    requestId: string;
    correlationId: string;
    pagination?: { page: number; pageSize: number; total: number };
  };
};

export type ApiRequestOptions = {
  ifMatch?: string;
  idempotencyKey?: string;
  query?: Record<string, string | undefined>;
};

export type ApiResult<T> = {
  data: T;
  etag?: string;
  meta?: ApiSuccess<T>["meta"];
};

function devPrincipalHeader(): Record<string, string> {
  const stored = getDevPrincipal();
  const raw = stored ?? process.env.NEXT_PUBLIC_DEV_PRINCIPAL;
  if (!raw) return {};
  return { "x-forge-dev-principal": raw };
}

function authHeaders(): Record<string, string> {
  const bearer = getBearerToken();
  if (bearer) {
    return { Authorization: `Bearer ${bearer}` };
  }
  return devPrincipalHeader();
}

function buildQuery(query?: Record<string, string | undefined>): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") {
      params.set(key, value);
    }
  }
  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}

function requestHeaders(options?: ApiRequestOptions, withJson = false): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...authHeaders(),
  };
  if (withJson) {
    headers["Content-Type"] = "application/json";
  }
  if (options?.ifMatch) {
    headers["If-Match"] = options.ifMatch;
  }
  if (options?.idempotencyKey) {
    headers["Idempotency-Key"] = options.idempotencyKey;
  }
  return headers;
}

async function parseResponse<T>(res: Response): Promise<ApiResult<T>> {
  const etagHeader = res.headers.get("etag");
  let body: ApiSuccess<T> | { error: { message: string } };
  try {
    body = (await res.json()) as ApiSuccess<T> | { error: { message: string } };
  } catch {
    throw new Error(`Request failed: ${res.status}`);
  }
  if (!res.ok || "error" in body) {
    throw new Error("error" in body ? body.error.message : `Request failed: ${res.status}`);
  }
  const result: ApiResult<T> = { data: body.data, meta: body.meta };
  if (etagHeader) {
    result.etag = etagHeader;
  }
  return result;
}

export async function apiGet<T>(path: string, options?: ApiRequestOptions): Promise<T> {
  const result = await apiGetResult<T>(path, options);
  return result.data;
}

export async function apiGetResult<T>(
  path: string,
  options?: ApiRequestOptions,
): Promise<ApiResult<T>> {
  const res = await fetch(`${API_URL}${path}${buildQuery(options?.query)}`, {
    headers: requestHeaders(options),
    cache: "no-store",
  });
  return parseResponse<T>(res);
}

export async function apiSend<T>(
  path: string,
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  payload?: unknown,
  options?: ApiRequestOptions,
): Promise<T> {
  const result = await apiSendResult<T>(path, method, payload, options);
  return result.data;
}

export async function apiSendResult<T>(
  path: string,
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  payload?: unknown,
  options?: ApiRequestOptions,
): Promise<ApiResult<T>> {
  const init: RequestInit = {
    method,
    headers: requestHeaders(options, payload !== undefined),
    cache: "no-store",
  };
  if (payload !== undefined) {
    init.body = JSON.stringify(payload);
  }
  const res = await fetch(`${API_URL}${path}${buildQuery(options?.query)}`, init);
  return parseResponse<T>(res);
}

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
