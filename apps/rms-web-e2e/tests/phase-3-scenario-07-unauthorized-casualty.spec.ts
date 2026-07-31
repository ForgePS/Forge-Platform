import { test, expect } from "../src/fixtures/index.js";
import { apiRequest, readTenantId } from "../src/helpers/api.js";
import {
  getBaseUrl,
  getSecondaryCredentials,
  hasSecondaryCredentials,
  REQUIRE_SECONDARY,
} from "../src/env.js";
import { ensureAuthenticated } from "../src/helpers/navigation.js";
import { e2eRunId } from "../src/helpers/test-data.js";
import {
  activateSpecialtySection,
  createStructureFireIncident,
  expectDenied,
  unwrapData,
} from "../src/helpers/specialty.js";

const FAKE_UUID = "00000000-0000-4000-8000-000000000099";

test.describe("Phase 3 scenario 7 — unauthorized casualty access @phase3", () => {
  test("unauthorized user denied across web, API, IDs, headers, RLS, review", async ({
    authenticatedPage: page,
    browser,
  }) => {
    test.setTimeout(240_000);
    test.skip(!hasSecondaryCredentials(), REQUIRE_SECONDARY);

    const runId = e2eRunId();
    const tenantId = await readTenantId(page);
    expect(tenantId).toBeTruthy();
    const incidentId = await createStructureFireIncident(
      page,
      tenantId!,
      runId,
      "unauthorized casualty matrix",
    );
    await activateSpecialtySection(page, tenantId!, incidentId, "CIVILIAN_CASUALTIES");

    const secretName = `Secret Civilian ${runId}`;
    const create = await apiRequest(
      page,
      "POST",
      `/api/v1/tenants/${tenantId}/neris/incidents/${incidentId}/civilian-casualties`,
      {
        data: {
          personKnown: true,
          displayName: secretName,
          injuryType: "BURN",
          injurySeverity: "SEVERE",
          narrative: `Top secret injury detail ${runId}`,
        },
      },
    );
    expect([200, 201]).toContain(create.status);
    const casualty = unwrapData<{ id: string }>(create.json);

    const secondaryContext = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });
    const secondaryPage = await secondaryContext.newPage();
    const consoleLogs: string[] = [];
    secondaryPage.on("console", (msg) => consoleLogs.push(msg.text()));
    await ensureAuthenticated(secondaryPage, getSecondaryCredentials());
    const secondaryTenantId = await readTenantId(secondaryPage);
    expect(secondaryTenantId).not.toBe(tenantId);

    // RMS Web direct route — no secret flash.
    await secondaryPage.goto(`${getBaseUrl()}/incidents/${incidentId}/`);
    await expect(secondaryPage.locator("body")).toBeVisible();
    const webText = await secondaryPage.locator("body").innerText();
    expect(webText).not.toContain(secretName);
    expect(webText).not.toContain(`Top secret injury detail ${runId}`);

    const probes: Array<{ label: string; result: { status: number; body: string } }> = [];

    probes.push({
      label: "direct API",
      result: await apiRequest(
        secondaryPage,
        "GET",
        `/api/v1/tenants/${tenantId}/neris/incidents/${incidentId}/civilian-casualties/${casualty.id}`,
      ),
    });
    probes.push({
      label: "modified resource ID",
      result: await apiRequest(
        secondaryPage,
        "GET",
        `/api/v1/tenants/${tenantId}/neris/incidents/${incidentId}/civilian-casualties/${FAKE_UUID}`,
      ),
    });
    probes.push({
      label: "modified tenant header path",
      result: await apiRequest(
        secondaryPage,
        "GET",
        `/api/v1/tenants/${secondaryTenantId}/neris/incidents/${incidentId}/civilian-casualties/${casualty.id}`,
        { headers: { "x-forge-tenant-id": tenantId! } },
      ),
    });
    probes.push({
      label: "modified incident ID",
      result: await apiRequest(
        secondaryPage,
        "GET",
        `/api/v1/tenants/${tenantId}/neris/incidents/${FAKE_UUID}/civilian-casualties/${casualty.id}`,
      ),
    });
    probes.push({
      label: "modified casualty ID on primary tenant as secondary",
      result: await apiRequest(
        secondaryPage,
        "GET",
        `/api/v1/tenants/${tenantId}/neris/incidents/${incidentId}/civilian-casualties/${FAKE_UUID}`,
      ),
    });
    probes.push({
      label: "RLS probe primary→secondary tenant",
      result: await apiRequest(
        page,
        "GET",
        `/api/v1/tenants/${secondaryTenantId}/neris/incidents/${incidentId}/civilian-casualties/${casualty.id}`,
      ),
    });
    probes.push({
      label: "review interface comments cross-tenant",
      result: await apiRequest(
        secondaryPage,
        "GET",
        `/api/v1/tenants/${tenantId}/neris/incidents/${incidentId}/review-comments`,
      ),
    });
    probes.push({
      label: "export/reporting-ish validation endpoint",
      result: await apiRequest(
        secondaryPage,
        "POST",
        `/api/v1/tenants/${tenantId}/neris/incidents/${incidentId}/validate`,
        { data: {} },
      ),
    });

    for (const probe of probes) {
      expectDenied(probe.result.status, probe.label);
      expect(probe.result.body, probe.label).not.toContain(secretName);
      expect(probe.result.body, probe.label).not.toContain(`Top secret injury detail ${runId}`);
    }

    expect(consoleLogs.join("\n")).not.toContain(secretName);
    expect(consoleLogs.join("\n")).not.toContain(`Top secret injury detail ${runId}`);

    await secondaryContext.close();
  });
});
