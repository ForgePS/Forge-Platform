import { getActiveTenantId, getBearerToken, getDevPrincipal } from "./auth-storage.js";

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
  signal?: AbortSignal;
};

export type ApiResult<T> = {
  data: T;
  etag?: string;
  meta?: ApiSuccess<T>["meta"];
};

export type ApiClientConfig = {
  baseUrl?: string;
  devPrincipalEnv?: string;
  onUnauthorized?: () => void;
};

let clientConfig: ApiClientConfig = {};

export function configureApiClient(config: ApiClientConfig): void {
  clientConfig = { ...clientConfig, ...config };
}

export function getApiClientConfig(): ApiClientConfig {
  return clientConfig;
}

export function getApiBaseUrl(): string {
  const base = clientConfig.baseUrl?.trim();
  if (!base) {
    throw new Error(
      "API client baseUrl is not configured. Call configureApiClient({ baseUrl }) before requests.",
    );
  }
  return base;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    if (code !== undefined) {
      this.code = code;
    }
  }
}

export class ApiConflictError extends ApiError {
  constructor(message: string) {
    super(message, 412, "PRECONDITION_FAILED");
    this.name = "ApiConflictError";
  }
}

function allowDevPrincipal(): boolean {
  // Deployed builds must omit NEXT_PUBLIC_ALLOW_DEV_PRINCIPAL (see sync-static-site).
  // Hosted environments must not silently impersonate via leftover localStorage values.
  return process.env.NEXT_PUBLIC_ALLOW_DEV_PRINCIPAL === "true";
}

function devPrincipalHeader(): Record<string, string> {
  if (!allowDevPrincipal()) return {};
  const stored = getDevPrincipal();
  const raw = stored ?? clientConfig.devPrincipalEnv;
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
  const activeTenantId = getActiveTenantId();
  if (activeTenantId) {
    headers["x-tenant-id"] = activeTenantId;
  }
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

async function parseResponse<T>(
  res: Response,
  /**
   * Whether this request carried Authorization. Anonymous 401s (e.g. AuthProvider
   * bootstrap on /auth/callback) must not clear tokens that a concurrent OAuth
   * exchange just wrote to storage.
   */
  hadAuthorization: boolean,
): Promise<ApiResult<T>> {
  const etagHeader = res.headers.get("etag");
  let body: ApiSuccess<T> | { error: { message: string; code?: string } };
  try {
    body = (await res.json()) as ApiSuccess<T> | { error: { message: string; code?: string } };
  } catch {
    throw new ApiError(`Request failed: ${res.status}`, res.status);
  }

  if (res.status === 412) {
    const message = "error" in body ? body.error.message : "Resource was modified elsewhere";
    throw new ApiConflictError(message);
  }

  if (res.status === 401 && hadAuthorization) {
    clientConfig.onUnauthorized?.();
  }

  if (!res.ok || "error" in body) {
    const message = "error" in body ? body.error.message : `Request failed: ${res.status}`;
    const code = "error" in body ? body.error.code : undefined;
    throw new ApiError(message, res.status, code ?? undefined);
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
  const headers = requestHeaders(options);
  const res = await fetch(`${getApiBaseUrl()}${path}${buildQuery(options?.query)}`, {
    headers,
    cache: "no-store",
    ...(options?.signal ? { signal: options.signal } : {}),
  });
  return parseResponse<T>(res, Boolean(headers.Authorization));
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
  const headers = requestHeaders(options, payload !== undefined);
  const init: RequestInit = {
    method,
    headers,
    cache: "no-store",
    ...(options?.signal ? { signal: options.signal } : {}),
  };
  if (payload !== undefined) {
    init.body = JSON.stringify(payload);
  }
  const res = await fetch(`${getApiBaseUrl()}${path}${buildQuery(options?.query)}`, init);
  return parseResponse<T>(res, Boolean(headers.Authorization));
}

export async function apiFetchRaw(path: string): Promise<Response> {
  return fetch(`${getApiBaseUrl()}${path}`, {
    headers: requestHeaders(),
    cache: "no-store",
  });
}

export function toIfMatch(recordVersion: number): string {
  return `W/"${recordVersion}"`;
}

export function createIdempotencyKey(prefix = "web"): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
