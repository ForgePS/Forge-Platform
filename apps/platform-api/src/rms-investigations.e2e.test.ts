import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createId, rmsInvestigationCases, withTenantTransaction } from "@forge/database";
import { eq } from "drizzle-orm";
import { E2eHarness } from "./testing/e2e-harness.js";

describe("RMS investigations domain", () => {
  const harness = new E2eHarness();

  beforeAll(async () => {
    await harness.init();
  }, 360_000);

  afterAll(async () => {
    await harness.cleanup();
    await harness.close();
  });

  async function createUser(tenantId: string) {
    return harness.createUser({
      tenantId,
      email: `investigation-${createId()}@example.test`,
      roleCode: "RMS_INVESTIGATOR",
      rolePermissions: ["rms.masterdata.read", "rms.masterdata.manage"],
      moduleCodes: ["CORE", "NERIS"],
    });
  }

  it("persists evidence custody, review, and gated closeout", async () => {
    const tenant = await harness.createTenant({ moduleCodes: ["CORE", "NERIS"] });
    const user = await createUser(tenant.tenantId);
    const api = harness.api(user.userId, tenant.tenantId);

    const occupancy = await api
      .post(`/api/v1/tenants/${tenant.tenantId}/rms/occupancies`)
      .set("Idempotency-Key", createId())
      .send({ name: "Investigation Test Occupancy", addressLine1: "700 Origin Ave", status: "ACTIVE" })
      .expect(200);

    const created = await api
      .post(`/api/v1/tenants/${tenant.tenantId}/rms/investigations`)
      .set("Idempotency-Key", createId())
      .send({
        occupancyId: occupancy.body.data.id,
        caseType: "ORIGIN_CAUSE",
        leadInvestigator: "Test Investigator",
        status: "OPEN",
        location: "700 Origin Ave",
        sceneStatus: "SECURED",
        weather: "Clear / 72 F",
        initialObservations: "Fire damage concentrated in the rear storage area.",
      })
      .expect(200);

    const caseId = created.body.data.id as string;
    let version = created.body.data.recordVersion as number;

    const evidence = await api
      .post(`/api/v1/tenants/${tenant.tenantId}/rms/investigations/${caseId}/evidence`)
      .set("Idempotency-Key", createId())
      .send({
        evidenceType: "PHYSICAL",
        tagNumber: "EV-001",
        title: "Electrical receptacle",
        collectedAt: "2026-10-02T14:00:00.000Z",
        collectedBy: "Test Investigator",
        currentCustodian: "Test Investigator",
        storageLocation: "Evidence Locker A",
        status: "IN_CUSTODY",
      })
      .expect(200);

    const evidenceId = evidence.body.data.id as string;

    const custody = await api
      .post(`/api/v1/tenants/${tenant.tenantId}/rms/investigation-evidence/${evidenceId}/custody-events`)
      .set("Idempotency-Key", createId())
      .send({
        action: "TRANSFERRED",
        occurredAt: "2026-10-02T15:00:00.000Z",
        fromCustodian: "Test Investigator",
        toCustodian: "Evidence Technician",
        location: "Evidence Locker B",
        notes: "Transferred for secure storage.",
      })
      .expect(200);
    expect(custody.body.data.evidence.currentCustodian).toBe("Evidence Technician");
    expect(custody.body.data.evidence.storageLocation).toBe("Evidence Locker B");

    const analysis = await api
      .patch(`/api/v1/tenants/${tenant.tenantId}/rms/investigations/${caseId}`)
      .set("If-Match", `W/"${version}"`)
      .send({
        status: "ANALYSIS",
        areaOfOrigin: "Rear storage area",
        causeClassification: "ACCIDENTAL",
        causeNarrative: "Evidence supports accidental electrical ignition.",
        disposition: "Origin and cause documented",
      })
      .expect(200);
    version = analysis.body.data.recordVersion;

    await api
      .patch(`/api/v1/tenants/${tenant.tenantId}/rms/investigations/${caseId}`)
      .set("If-Match", `W/"${version}"`)
      .send({ status: "CLOSED" })
      .expect(400);

    const pending = await api
      .patch(`/api/v1/tenants/${tenant.tenantId}/rms/investigations/${caseId}`)
      .set("If-Match", `W/"${version}"`)
      .send({
        supervisorReviewStatus: "PENDING",
        supervisorReviewer: "Test Supervisor",
        supervisorNotes: "Submitted for review.",
      })
      .expect(200);
    version = pending.body.data.recordVersion;
    expect(pending.body.data.status).toBe("PENDING_REVIEW");

    const approved = await api
      .patch(`/api/v1/tenants/${tenant.tenantId}/rms/investigations/${caseId}`)
      .set("If-Match", `W/"${version}"`)
      .send({
        supervisorReviewStatus: "APPROVED",
        supervisorReviewer: "Test Supervisor",
        supervisorNotes: "Approved for closeout.",
      })
      .expect(200);
    version = approved.body.data.recordVersion;
    expect(approved.body.data.supervisorReviewStatus).toBe("APPROVED");

    const closed = await api
      .patch(`/api/v1/tenants/${tenant.tenantId}/rms/investigations/${caseId}`)
      .set("If-Match", `W/"${version}"`)
      .send({ status: "CLOSED" })
      .expect(200);
    expect(closed.body.data.closedAt).toBeTruthy();

    const detail = await api
      .get(`/api/v1/tenants/${tenant.tenantId}/rms/investigations/${caseId}`)
      .expect(200);
    expect(detail.body.data.evidence).toHaveLength(1);
    expect(detail.body.data.custodyEvents).toHaveLength(2);
  });

  it("enforces investigation tenant isolation through RLS", async () => {
    const tenantA = await harness.createTenant({ moduleCodes: ["CORE", "NERIS"] });
    const tenantB = await harness.createTenant({ moduleCodes: ["CORE", "NERIS"] });
    const userA = await createUser(tenantA.tenantId);
    const api = harness.api(userA.userId, tenantA.tenantId);

    const created = await api
      .post(`/api/v1/tenants/${tenantA.tenantId}/rms/investigations`)
      .set("Idempotency-Key", createId())
      .send({ caseType: "ADMIN_REVIEW", status: "OPEN", leadInvestigator: "Tenant A Investigator" })
      .expect(200);

    await expect(
      withTenantTransaction(harness.appDb, tenantB.tenantId, async (tx) =>
        tx.query.rmsInvestigationCases.findFirst({ where: eq(rmsInvestigationCases.id, created.body.data.id) }),
      ),
    ).resolves.toBeUndefined();
  });
});
