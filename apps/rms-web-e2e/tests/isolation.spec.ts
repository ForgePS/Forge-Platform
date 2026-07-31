import type { Browser, BrowserContext, Page } from "@playwright/test";
import { test, expect, skipWithoutCredentials } from "../src/fixtures/index.js";
import {
  getBaseUrl,
  getPrimaryCredentials,
  getSecondaryCredentials,
  hasSecondaryCredentials,
  REQUIRE_SECONDARY,
} from "../src/env.js";
import {
  apiRequest,
  approveIncidentRaw,
  archiveIncidentRaw,
  finalizeIncidentRaw,
  getIncidentRaw,
  incidentIdsFromList,
  listConfigurationRaw,
  listIncidents,
  listPersonnelRaw,
  listStationsRaw,
  listUnitsRaw,
  patchIncidentRaw,
  readTenantId,
  submitIncidentRaw,
  voidIncidentRaw,
} from "../src/helpers/api.js";
import { createManualIncident, ensureAuthenticated } from "../src/helpers/navigation.js";
import { e2eRunId, syntheticDispatchDescription } from "../src/helpers/test-data.js";

const DENIED_STATUSES = [403, 404];

function expectDeniedStatus(status: number, label: string): void {
  expect(DENIED_STATUSES, `${label} expected 403 or 404, got ${status}`).toContain(status);
}

type IsolationState = {
  primaryContext: BrowserContext;
  secondaryContext: BrowserContext;
  primaryPage: Page;
  secondaryPage: Page;
  primaryTenantId: string;
  secondaryTenantId: string;
  primaryIncidentId: string;
};

async function openIsolationPair(browser: Browser): Promise<IsolationState> {
  if (!hasSecondaryCredentials()) {
    throw new Error(REQUIRE_SECONDARY);
  }

  const primary = getPrimaryCredentials();
  const secondary = getSecondaryCredentials();

  const emptyState = { cookies: [] as [], origins: [] as [] };
  const primaryContext = await browser.newContext({ storageState: emptyState });
  const secondaryContext = await browser.newContext({ storageState: emptyState });
  const primaryPage = await primaryContext.newPage();
  const secondaryPage = await secondaryContext.newPage();

  try {
    await ensureAuthenticated(primaryPage, primary);
    const primaryTenantId = await readTenantId(primaryPage);
    if (!primaryTenantId) {
      throw new Error("Could not resolve primary tenant id from /auth/me");
    }

    const runId = e2eRunId();
    const primaryIncidentId = await createManualIncident(
      primaryPage,
      syntheticDispatchDescription(runId),
    );

    // Clear any Cognito Hosted UI cookies in this context before secondary login.
    await secondaryContext.clearCookies();
    await ensureAuthenticated(secondaryPage, secondary);
    const secondaryTenantId = await readTenantId(secondaryPage);
    if (!secondaryTenantId) {
      throw new Error("Could not resolve secondary tenant id from /auth/me");
    }
    if (secondaryTenantId === primaryTenantId) {
      const me = await apiRequest(secondaryPage, "GET", "/api/v1/auth/me");
      throw new Error(
        `Secondary Cognito user resolved to the same tenant as primary (${primaryTenantId}); isolation tests need distinct tenants. /auth/me=${JSON.stringify(me.json ?? me.body).slice(0, 500)}`,
      );
    }

    return {
      primaryContext,
      secondaryContext,
      primaryPage,
      secondaryPage,
      primaryTenantId,
      secondaryTenantId,
      primaryIncidentId,
    };
  } catch (error) {
    await primaryContext.close().catch(() => {});
    await secondaryContext.close().catch(() => {});
    throw error;
  }
}

async function closeIsolationPair(state: IsolationState): Promise<void> {
  await state.primaryContext.close().catch(() => {});
  await state.secondaryContext.close().catch(() => {});
}

test.describe("Cross-tenant isolation @smoke", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(() => {
    skipWithoutCredentials();
  });

  let state: IsolationState;

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(180_000);
    skipWithoutCredentials();
    if (!hasSecondaryCredentials()) {
      throw new Error(REQUIRE_SECONDARY);
    }
    state = await openIsolationPair(browser);
  });

  test.afterAll(async () => {
    if (state) {
      await closeIsolationPair(state);
    }
  });

  test("secondary cannot open primary incident in UI", async () => {
    const { secondaryPage, primaryIncidentId } = state;
    await secondaryPage.goto(`${getBaseUrl()}/incidents/${primaryIncidentId}/`);

    const denied = secondaryPage
      .getByText(
        /incident not found|forbidden|not authorized|access denied|failed to load incident|tenant mismatch|no active access/i,
      )
      .first();

    await expect(denied).toBeVisible({ timeout: 20_000 });
  });

  test("secondary listing own tenant incidents excludes primary incident", async () => {
    const { secondaryPage, secondaryTenantId, primaryIncidentId } = state;
    const listed = await listIncidents(secondaryPage, secondaryTenantId);
    expect(listed.status, `list own incidents: ${listed.body}`).toBe(200);

    const ids = incidentIdsFromList(listed.json);
    expect(ids).not.toContain(primaryIncidentId);
  });

  test("secondary GET primary incident under secondary tenant path is denied", async () => {
    const { secondaryPage, secondaryTenantId, primaryIncidentId } = state;
    const result = await getIncidentRaw(secondaryPage, secondaryTenantId, primaryIncidentId);
    expectDeniedStatus(result.status, "GET primary incident via secondary tenantId");
  });

  test("secondary GET with primary tenantId in URL is tenant mismatch 403", async () => {
    const { secondaryPage, primaryTenantId, primaryIncidentId } = state;
    const result = await getIncidentRaw(secondaryPage, primaryTenantId, primaryIncidentId);
    expect(result.status, `tenant mismatch GET: ${result.body}`).toBe(403);
    expect(result.body).toMatch(/tenant mismatch|no active access|forbidden/i);
  });

  test("secondary mutation endpoints against primary incident are denied", async () => {
    const { secondaryPage, primaryTenantId, secondaryTenantId, primaryIncidentId } = state;

    const probes: Array<{ label: string; run: () => Promise<{ status: number; body: string }> }> = [
      {
        label: "PATCH primary path",
        run: () =>
          patchIncidentRaw(secondaryPage, primaryTenantId, primaryIncidentId, {
            dispatchDescription: "isolation probe",
          }),
      },
      {
        label: "PATCH secondary path",
        run: () =>
          patchIncidentRaw(secondaryPage, secondaryTenantId, primaryIncidentId, {
            dispatchDescription: "isolation probe",
          }),
      },
      {
        label: "submit primary path",
        run: () => submitIncidentRaw(secondaryPage, primaryTenantId, primaryIncidentId, {}),
      },
      {
        label: "approve primary path",
        run: () => approveIncidentRaw(secondaryPage, primaryTenantId, primaryIncidentId),
      },
      {
        label: "finalize primary path",
        run: () => finalizeIncidentRaw(secondaryPage, primaryTenantId, primaryIncidentId),
      },
      {
        label: "void primary path",
        run: () => voidIncidentRaw(secondaryPage, primaryTenantId, primaryIncidentId),
      },
      {
        label: "archive primary path",
        run: () => archiveIncidentRaw(secondaryPage, primaryTenantId, primaryIncidentId),
      },
    ];

    for (const probe of probes) {
      const result = await probe.run();
      expectDeniedStatus(result.status, probe.label);
    }
  });

  test("secondary cannot list primary stations/units/personnel/config", async () => {
    const { secondaryPage, primaryTenantId } = state;

    const stations = await listStationsRaw(secondaryPage, primaryTenantId);
    const units = await listUnitsRaw(secondaryPage, primaryTenantId);
    const personnel = await listPersonnelRaw(secondaryPage, primaryTenantId);
    const configuration = await listConfigurationRaw(secondaryPage, primaryTenantId);

    expectDeniedStatus(stations.status, "list primary stations");
    expectDeniedStatus(units.status, "list primary units");
    expectDeniedStatus(personnel.status, "list primary personnel");
    expectDeniedStatus(configuration.status, "list primary configuration");
  });

  test("spoofed x-tenant-id header to primary tenant is still denied", async () => {
    const { secondaryPage, primaryTenantId, primaryIncidentId } = state;
    const spoofHeaders = { "x-tenant-id": primaryTenantId };

    const getSpoof = await getIncidentRaw(secondaryPage, primaryTenantId, primaryIncidentId, {
      headers: spoofHeaders,
    });
    expectDeniedStatus(getSpoof.status, "GET primary with spoofed x-tenant-id");

    const stationsSpoof = await apiRequest(
      secondaryPage,
      "GET",
      `/api/v1/tenants/${primaryTenantId}/rms/stations`,
      { headers: spoofHeaders },
    );
    expectDeniedStatus(stationsSpoof.status, "list stations with spoofed x-tenant-id");

    const patchSpoof = await patchIncidentRaw(
      secondaryPage,
      primaryTenantId,
      primaryIncidentId,
      { dispatchDescription: "spoof probe" },
      { headers: spoofHeaders },
    );
    expectDeniedStatus(patchSpoof.status, "PATCH with spoofed x-tenant-id");
  });
});
