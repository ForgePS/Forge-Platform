import {
  getApiBaseUrl,
  getBearerToken,
  getDevPrincipal,
  authMe as webKitAuthMe,
  selectTenant as webKitSelectTenant,
  logoutAll as webKitLogoutAll,
  type AuthMe,
  type AuthTenant,
} from "@forge/web-kit";

export type { AuthMe, AuthTenant };

const allowDevPrincipal = process.env.NEXT_PUBLIC_ALLOW_DEV_PRINCIPAL === "true";

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

function apiUrl(): string {
  return getApiBaseUrl();
}

function devPrincipalHeader(): Record<string, string> {
  if (!allowDevPrincipal) return {};
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
  let body:
    | ApiSuccess<T>
    | {
        error: {
          message: string;
          code?: string;
          details?: Array<{ path?: string; message?: string }>;
          debugMessage?: string;
          debugName?: string;
        };
      };
  try {
    body = (await res.json()) as
      | ApiSuccess<T>
      | {
          error: {
            message: string;
            code?: string;
            details?: Array<{ path?: string; message?: string }>;
            debugMessage?: string;
            debugName?: string;
          };
        };
  } catch {
    throw new Error(`Request failed: ${res.status}`);
  }
  if (!res.ok || "error" in body) {
    if ("error" in body) {
      const details = Array.isArray(body.error.details)
        ? body.error.details
            .map((d) => {
              const path = d.path ? `${d.path}: ` : "";
              return `${path}${d.message ?? ""}`.trim();
            })
            .filter(Boolean)
            .join("; ")
        : "";
      const debug = body.error.debugMessage
        ? ` [${body.error.debugName ?? "error"}: ${body.error.debugMessage}]`
        : "";
      const extra = [details, debug].filter(Boolean).join(" ");
      throw new Error(extra ? `${body.error.message} (${extra})` : body.error.message);
    }
    throw new Error(`Request failed: ${res.status}`);
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
  const res = await fetch(`${apiUrl()}${path}${buildQuery(options?.query)}`, {
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
  const res = await fetch(`${apiUrl()}${path}${buildQuery(options?.query)}`, init);
  return parseResponse<T>(res);
}

export async function apiFetchRaw(path: string): Promise<Response> {
  return fetch(`${apiUrl()}${path}`, {
    headers: requestHeaders(),
    cache: "no-store",
  });
}

// ---------------------------------------------------------------------------
// Auth (delegates to @forge/web-kit — Cognito access_token only)
// ---------------------------------------------------------------------------

export function authMe(): Promise<AuthMe> {
  return webKitAuthMe();
}

export function selectTenant(tenantId: string): Promise<AuthMe> {
  return webKitSelectTenant(tenantId);
}

export function logoutAll(): Promise<{ sessionVersion: number }> {
  return webKitLogoutAll();
}

// ---------------------------------------------------------------------------
// Invitations
// ---------------------------------------------------------------------------

export type Invitation = {
  id: string;
  tenantId: string;
  email: string;
  status: string;
  firstName: string | null;
  lastName: string | null;
  expiresAt: string | null;
  sentAt: string | null;
  acceptedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export function listInvitations(query?: {
  tenantId?: string;
  status?: string;
  email?: string;
}): Promise<Invitation[]> {
  const options: ApiRequestOptions = {};
  if (query) {
    options.query = query;
  }
  return apiGet<Invitation[]>("/api/v1/auth/invitations", options);
}

export function getInvitation(
  invitationId: string,
  query?: { tenantId?: string },
): Promise<Invitation> {
  const options: ApiRequestOptions = {};
  if (query) {
    options.query = query;
  }
  return apiGet<Invitation>(`/api/v1/auth/invitations/${invitationId}`, options);
}

export function createInvitation(
  payload: {
    tenantId: string;
    email: string;
    firstName?: string;
    lastName?: string;
    roleCodes?: string[];
    send?: boolean;
  },
  options?: ApiRequestOptions,
): Promise<Invitation> {
  return apiSend<Invitation>("/api/v1/auth/invitations", "POST", payload, options);
}

export function resendInvitation(
  invitationId: string,
  query?: { tenantId?: string },
): Promise<Invitation> {
  const options: ApiRequestOptions = {};
  if (query) {
    options.query = query;
  }
  return apiSend<Invitation>(
    `/api/v1/auth/invitations/${invitationId}/resend`,
    "POST",
    undefined,
    options,
  );
}

export function revokeInvitation(
  invitationId: string,
  reason: string,
  query?: { tenantId?: string },
): Promise<Invitation> {
  const options: ApiRequestOptions = {};
  if (query) {
    options.query = query;
  }
  return apiSend<Invitation>(
    `/api/v1/auth/invitations/${invitationId}/revoke`,
    "POST",
    { reason },
    options,
  );
}

// ---------------------------------------------------------------------------
// Memberships
// ---------------------------------------------------------------------------

export type Membership = {
  id: string;
  tenantId: string;
  userId: string;
  status: string;
  isDefaultTenant: boolean;
  activatedAt: string | null;
  suspendedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  recordVersion: number;
  createdAt: string;
  updatedAt: string;
  email: string;
  userStatus: string;
};

export function listMemberships(
  tenantId: string,
  query?: { status?: string; userId?: string },
): Promise<Membership[]> {
  const options: ApiRequestOptions = {};
  if (query) {
    options.query = query;
  }
  return apiGet<Membership[]>(`/api/v1/tenants/${tenantId}/memberships`, options);
}

export function getMembership(
  tenantId: string,
  membershipId: string,
): Promise<ApiResult<Membership>> {
  return apiGetResult<Membership>(`/api/v1/tenants/${tenantId}/memberships/${membershipId}`);
}

export function createMembership(
  tenantId: string,
  payload: {
    userId: string;
    status?: "PENDING" | "ACTIVE";
    roleCodes?: string[];
  },
  options?: ApiRequestOptions,
): Promise<Membership> {
  return apiSend<Membership>(`/api/v1/tenants/${tenantId}/memberships`, "POST", payload, options);
}

export function suspendMembership(
  tenantId: string,
  membershipId: string,
  reason: string,
  ifMatch: string,
): Promise<Membership> {
  return apiSend<Membership>(
    `/api/v1/tenants/${tenantId}/memberships/${membershipId}/suspend`,
    "POST",
    { reason },
    { ifMatch },
  );
}

export function revokeMembership(
  tenantId: string,
  membershipId: string,
  reason: string,
  ifMatch: string,
): Promise<Membership> {
  return apiSend<Membership>(
    `/api/v1/tenants/${tenantId}/memberships/${membershipId}/revoke`,
    "POST",
    { reason },
    { ifMatch },
  );
}

export function activateMembership(
  tenantId: string,
  membershipId: string,
  ifMatch: string,
): Promise<Membership> {
  return apiSend<Membership>(
    `/api/v1/tenants/${tenantId}/memberships/${membershipId}/activate`,
    "POST",
    undefined,
    { ifMatch },
  );
}

export function membershipHistory(tenantId: string, membershipId: string) {
  return apiGet<
    Array<{
      id: string;
      action: string;
      fromStatus: string | null;
      toStatus: string | null;
      reason: string | null;
      occurredAt: string;
    }>
  >(`/api/v1/tenants/${tenantId}/memberships/${membershipId}/history`);
}

// ---------------------------------------------------------------------------
// Onboarding (Wave 5 scaffold)
// ---------------------------------------------------------------------------

export type OnboardingSession = {
  id: string;
  tenantId: string;
  status: string;
  currentStep: number;
  templateCode: string | null;
  customerType: string;
};

export async function onboardingStart(payload: {
  customerType: string;
  templateCode?: string;
}): Promise<OnboardingSession> {
  return apiSend<OnboardingSession>("/api/v1/onboarding/start", "POST", payload);
}

export async function onboardingCompleteStep(
  sessionId: string,
  stepNumber: number,
  payload: Record<string, unknown>,
): Promise<OnboardingSession> {
  return apiSend<OnboardingSession>(
    `/api/v1/onboarding/${sessionId}/steps/${stepNumber}/complete`,
    "POST",
    payload,
  );
}

export async function onboardingActivate(sessionId: string): Promise<OnboardingSession> {
  return apiSend<OnboardingSession>(`/api/v1/onboarding/${sessionId}/activate`, "POST");
}

// ---------------------------------------------------------------------------
// Platform health
// ---------------------------------------------------------------------------

export type HealthPayload = {
  status: string;
  service: string;
  environment: string;
  version: string;
  timestamp: string;
};

export type ReadyPayload = {
  status: string;
  service: string;
  checks: { database: boolean };
  timestamp: string;
};

export async function fetchHealth(): Promise<HealthPayload> {
  const res = await apiFetchRaw("/health");
  if (!res.ok) {
    throw new Error(`Health check failed: ${res.status}`);
  }
  return (await res.json()) as HealthPayload;
}

export async function fetchReady(): Promise<ReadyPayload | null> {
  const res = await apiFetchRaw("/ready");
  if (res.status === 503) {
    const body = (await res.json()) as ReadyPayload;
    return body;
  }
  if (!res.ok) {
    return null;
  }
  return (await res.json()) as ReadyPayload;
}

export function toIfMatch(recordVersion: number): string {
  return `W/"${recordVersion}"`;
}
