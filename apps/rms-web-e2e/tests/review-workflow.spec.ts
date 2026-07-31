import { test, expect } from "../src/fixtures/index.js";
import {
  approveIncidentRaw,
  finalizeIncident,
  getIncident,
  patchIncidentRaw,
  readTenantId,
  submitIncidentRaw,
  apiRequest,
} from "../src/helpers/api.js";
import {
  createManualIncident,
  openIncidentSection,
  waitForAutosaveSaved,
} from "../src/helpers/navigation.js";
import {
  e2eRunId,
  syntheticDispatchDescription,
  syntheticReturnReason,
  syntheticSubmitNote,
} from "../src/helpers/test-data.js";

async function expectApiStatus(
  page: import("@playwright/test").Page,
  tenantId: string,
  incidentId: string,
  status: string,
): Promise<void> {
  await expect
    .poll(async () => (await getIncident(page, tenantId, incidentId)).status, {
      timeout: 20_000,
    })
    .toMatch(new RegExp(`^${status}$`, "i"));
}

test.describe("Officer review workflow", () => {
  test("submit, return, correct, resubmit, approve, finalize, and block edits", async ({
    authenticatedPage: page,
  }) => {
    test.setTimeout(180_000);

    const runId = e2eRunId();
    const tenantId = await readTenantId(page);
    expect(tenantId).toBeTruthy();
    const incidentId = await createManualIncident(page, syntheticDispatchDescription(runId));

    // First meaningful edit promotes DRAFT → IN_PROGRESS (required before submit).
    await openIncidentSection(page, incidentId, "OVERVIEW");
    const overviewDispatch = page.getByLabel(/dispatch description/i);
    await overviewDispatch.waitFor({ state: "visible", timeout: 15_000 });
    await overviewDispatch.fill(`${syntheticDispatchDescription(runId)} Ready for review.`);
    await waitForAutosaveSaved(page);
    await expectApiStatus(page, tenantId!, incidentId, "IN_PROGRESS");

    let incident = await getIncident(page, tenantId!, incidentId);
    const typed = await patchIncidentRaw(
      page,
      tenantId!,
      incidentId,
      { primaryIncidentTypeCode: "STRUCTURE_FIRE" },
      { ifMatch: incident.recordVersion },
    );
    expect(typed.status).toBeLessThan(400);

    // Drive review transitions via Cognito API (same path specialty closeout uses).
    const submitted = await submitIncidentRaw(page, tenantId!, incidentId, {
      note: syntheticSubmitNote(runId),
    });
    expect(submitted.status, submitted.body).toBeLessThan(400);
    await expectApiStatus(page, tenantId!, incidentId, "SUBMITTED_FOR_REVIEW");

    await openIncidentSection(page, incidentId, "REVIEW");
    await expect(page.getByText(/Current status:\s*SUBMITTED_FOR_REVIEW/i)).toBeVisible({
      timeout: 15_000,
    });

    const returned = await apiRequest(
      page,
      "POST",
      `/api/v1/tenants/${tenantId}/neris/incidents/${incidentId}/return`,
      {
        data: {
          reason: syntheticReturnReason(runId),
          comments: [],
        },
      },
    );
    expect(returned.status, returned.body).toBeLessThan(400);
    await expectApiStatus(page, tenantId!, incidentId, "RETURNED_FOR_CORRECTION");

    await openIncidentSection(page, incidentId, "OVERVIEW");
    const dispatchField = page.getByLabel(/dispatch description/i);
    await dispatchField.fill(`${syntheticDispatchDescription(runId)} Corrected.`);
    await waitForAutosaveSaved(page);
    // Correction must promote RETURNED_FOR_CORRECTION → IN_PROGRESS before resubmit.
    await expectApiStatus(page, tenantId!, incidentId, "IN_PROGRESS");

    const resubmitted = await submitIncidentRaw(page, tenantId!, incidentId, {
      note: `${syntheticSubmitNote(runId)} resubmit`,
    });
    expect(resubmitted.status, resubmitted.body).toBeLessThan(400);
    await expectApiStatus(page, tenantId!, incidentId, "SUBMITTED_FOR_REVIEW");

    const approved = await approveIncidentRaw(page, tenantId!, incidentId);
    expect(approved.status, approved.body).toBeLessThan(400);
    await expectApiStatus(page, tenantId!, incidentId, "APPROVED");

    incident = await getIncident(page, tenantId!, incidentId);
    const finalized = await finalizeIncident(page, tenantId!, incidentId);
    expect(finalized.status).toMatch(/FINALIZED/i);

    await page.reload();
    await expect(page.getByText(/FINALIZED/i).first()).toBeVisible({ timeout: 15_000 });

    await openIncidentSection(page, incidentId, "OVERVIEW");
    const lockedField = page.getByLabel(/dispatch description/i);
    const priorValue = await lockedField.inputValue();
    await lockedField.fill(`${priorValue} blocked edit attempt`);

    const blocked = page
      .getByText(/locked|cannot edit|save failed|incident is locked|conflict/i)
      .first();
    await expect(blocked).toBeVisible({ timeout: 25_000 });
  });
});
