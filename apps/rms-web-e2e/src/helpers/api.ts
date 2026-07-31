import type { Page } from "@playwright/test";
import { getApiUrl } from "../env.js";

type ApiEnvelope<T> = {
  data: T;
};

export type IncidentDetail = {
  id: string;
  incidentNumber: string;
  status: string;
  recordVersion: number;
  dispatchDescription: string | null;
  primaryIncidentTypeCode?: string | null;
};

export type ApiRawResult = {
  status: number;
  body: string;
  json: unknown;
};

export type ApiRequestOptions = {
  headers?: Record<string, string>;
  data?: unknown;
  ifMatch?: string | number;
};

async function bearerTokenFromPage(page: Page): Promise<string | null> {
  return page.evaluate(() => localStorage.getItem("forge-bearer-token"));
}

function normalizePath(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

/**
 * Authenticated API call using the Cognito bearer from the Playwright page.
 * Does not send x-forge-dev-principal.
 */
export async function apiRequest(
  page: Page,
  method: string,
  path: string,
  options: ApiRequestOptions = {},
): Promise<ApiRawResult> {
  const token = await bearerTokenFromPage(page);
  if (!token) {
    throw new Error(`No bearer token available for ${method} ${path}`);
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    ...options.headers,
  };

  if (options.ifMatch !== undefined) {
    headers["If-Match"] = String(options.ifMatch);
  }

  const init: {
    method: string;
    headers: Record<string, string>;
    data?: string;
  } = {
    method: method.toUpperCase(),
    headers,
  };

  if (options.data !== undefined) {
    headers["Content-Type"] = "application/json";
    init.data = JSON.stringify(options.data);
  }

  const response = await page.context().request.fetch(`${getApiUrl()}${normalizePath(path)}`, init);
  const body = await response.text();
  let json: unknown = null;
  if (body) {
    try {
      json = JSON.parse(body) as unknown;
    } catch {
      json = null;
    }
  }

  return { status: response.status(), body, json };
}

export async function listIncidents(page: Page, tenantId: string): Promise<ApiRawResult> {
  return apiRequest(page, "GET", `/api/v1/tenants/${tenantId}/neris/incidents`);
}

export async function getIncidentRaw(
  page: Page,
  tenantId: string,
  incidentId: string,
  options: ApiRequestOptions = {},
): Promise<ApiRawResult> {
  return apiRequest(
    page,
    "GET",
    `/api/v1/tenants/${tenantId}/neris/incidents/${incidentId}`,
    options,
  );
}

export async function patchIncidentRaw(
  page: Page,
  tenantId: string,
  incidentId: string,
  data: unknown = {},
  options: ApiRequestOptions = {},
): Promise<ApiRawResult> {
  return apiRequest(page, "PATCH", `/api/v1/tenants/${tenantId}/neris/incidents/${incidentId}`, {
    ...options,
    data,
    ifMatch: options.ifMatch ?? 1,
  });
}

export async function submitIncidentRaw(
  page: Page,
  tenantId: string,
  incidentId: string,
  data: unknown = {},
  options: ApiRequestOptions = {},
): Promise<ApiRawResult> {
  return apiRequest(
    page,
    "POST",
    `/api/v1/tenants/${tenantId}/neris/incidents/${incidentId}/submit-for-review`,
    { ...options, data },
  );
}

export async function approveIncidentRaw(
  page: Page,
  tenantId: string,
  incidentId: string,
  options: ApiRequestOptions = {},
): Promise<ApiRawResult> {
  return apiRequest(
    page,
    "POST",
    `/api/v1/tenants/${tenantId}/neris/incidents/${incidentId}/approve`,
    options,
  );
}

export async function finalizeIncidentRaw(
  page: Page,
  tenantId: string,
  incidentId: string,
  options: ApiRequestOptions = {},
): Promise<ApiRawResult> {
  return apiRequest(
    page,
    "POST",
    `/api/v1/tenants/${tenantId}/neris/incidents/${incidentId}/finalize`,
    options,
  );
}

export async function voidIncidentRaw(
  page: Page,
  tenantId: string,
  incidentId: string,
  data: unknown = { reason: "e2e isolation probe" },
  options: ApiRequestOptions = {},
): Promise<ApiRawResult> {
  return apiRequest(
    page,
    "POST",
    `/api/v1/tenants/${tenantId}/neris/incidents/${incidentId}/void`,
    { ...options, data },
  );
}

export async function archiveIncidentRaw(
  page: Page,
  tenantId: string,
  incidentId: string,
  options: ApiRequestOptions = {},
): Promise<ApiRawResult> {
  return apiRequest(
    page,
    "POST",
    `/api/v1/tenants/${tenantId}/neris/incidents/${incidentId}/archive`,
    options,
  );
}

export async function listStationsRaw(page: Page, tenantId: string): Promise<ApiRawResult> {
  return apiRequest(page, "GET", `/api/v1/tenants/${tenantId}/rms/stations`);
}

export async function listUnitsRaw(page: Page, tenantId: string): Promise<ApiRawResult> {
  return apiRequest(page, "GET", `/api/v1/tenants/${tenantId}/rms/units`);
}

export async function listPersonnelRaw(page: Page, tenantId: string): Promise<ApiRawResult> {
  return apiRequest(page, "GET", `/api/v1/tenants/${tenantId}/rms/personnel`);
}

export async function listConfigurationRaw(page: Page, tenantId: string): Promise<ApiRawResult> {
  return apiRequest(page, "GET", `/api/v1/tenants/${tenantId}/configuration`);
}

export async function finalizeIncident(
  page: Page,
  tenantId: string,
  incidentId: string,
): Promise<IncidentDetail> {
  const result = await finalizeIncidentRaw(page, tenantId, incidentId);
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Finalize failed (${result.status}): ${result.body}`);
  }
  const payload = result.json as ApiEnvelope<IncidentDetail>;
  return payload.data;
}

export async function getIncident(
  page: Page,
  tenantId: string,
  incidentId: string,
): Promise<IncidentDetail> {
  const result = await getIncidentRaw(page, tenantId, incidentId);
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Get incident failed (${result.status}): ${result.body}`);
  }
  const payload = result.json as ApiEnvelope<IncidentDetail>;
  return payload.data;
}

export async function readTenantId(page: Page): Promise<string | null> {
  const result = await apiRequest(page, "GET", "/api/v1/auth/me");
  if (result.status < 200 || result.status >= 300) {
    return null;
  }
  const payload = result.json as { data?: { tenantId?: string | null } };
  return payload.data?.tenantId ?? null;
}

export function incidentIdsFromList(json: unknown): string[] {
  const data = (json as { data?: unknown })?.data;
  if (!Array.isArray(data)) {
    return [];
  }
  return data
    .map((item) => (item as { id?: string })?.id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
}
