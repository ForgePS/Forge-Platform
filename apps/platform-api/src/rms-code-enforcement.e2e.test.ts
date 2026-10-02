import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createId, rmsCodeCases, withTenantTransaction } from "@forge/database";
import { eq } from "drizzle-orm";
import { E2eHarness } from "./testing/e2e-harness.js";

describe("RMS code enforcement domain", () => {
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
      email: `code-${createId()}@example.test`,
      roleCode: "RMS_CODE_ENFORCEMENT_MANAGER",
      rolePermissions: ["rms.masterdata.read", "rms.masterdata.manage"],
      moduleCodes: ["CORE", "NERIS"],
    });
  }

  it("escalates an inspection finding through notice, compliance, and closeout", async () => {
    const tenant = await harness.createTenant({ moduleCodes: ["CORE", "NERIS"] });
    const user = await createUser(tenant.tenantId);
    const api = harness.api(user.userId, tenant.tenantId);

    const occupancy = await api
      .post(`/api/v1/tenants/${tenant.tenantId}/rms/occupancies`)
      .set("Idempotency-Key", createId())
      .send({ name: "Code Test Occupancy", addressLine1: "500 Compliance Dr", status: "ACTIVE" })
      .expect(200);

    const inspection = await api
      .post(`/api/v1/tenants/${tenant.tenantId}/rms/inspections`)
      .set("Idempotency-Key", createId())
      .send({
        occupancyId: occupancy.body.data.id,
        inspectionDate: "2026-10-02",
        status: "COMPLETED",
        overallResult: "FAIL",
        followUpDate: "2026-10-12",
      })
      .expect(200);

    const finding = await api
      .post(`/api/v1/tenants/${tenant.tenantId}/rms/inspections/${inspection.body.data.id}/findings`)
      .set("Idempotency-Key", createId())
      .send({
        title: "Exit obstruction",
        description: "Rear exit is obstructed.",
        severity: "HIGH",
        correctiveAction: "Remove all storage from required egress path.",
        responsibleParty: "Occupancy manager",
        dueDate: "2026-10-12",
        status: "OPEN",
      })
      .expect(200);

    const escalated = await api
      .post(`/api/v1/tenants/${tenant.tenantId}/rms/code-cases/from-finding/${finding.body.data.id}`)
      .set("Idempotency-Key", createId())
      .send({})
      .expect(200);

    expect(escalated.body.data.existing).toBe(false);
    expect(escalated.body.data.violation.inspectionFindingId).toBe(finding.body.data.id);
    const caseId = escalated.body.data.case.id as string;
    let caseVersion = escalated.body.data.case.recordVersion as number;
    const violationId = escalated.body.data.violation.id as string;
    let violationVersion = escalated.body.data.violation.recordVersion as number;

    const duplicate = await api
      .post(`/api/v1/tenants/${tenant.tenantId}/rms/code-cases/from-finding/${finding.body.data.id}`)
      .set("Idempotency-Key", createId())
      .send({})
      .expect(200);
    expect(duplicate.body.data.existing).toBe(true);
    expect(duplicate.body.data.case.id).toBe(caseId);

    const notice = await api
      .post(`/api/v1/tenants/${tenant.tenantId}/rms/code-cases/${caseId}/notices`)
      .set("Idempotency-Key", createId())
      .send({
        noticeType: "NOTICE_OF_VIOLATION",
        recipient: "Occupancy manager",
        deliveryMethod: "IN_PERSON",
        subject: "Notice of violation",
        bodySnapshot: "Correct the obstructed exit by October 12, 2026.",
      })
      .expect(200);
    expect(notice.body.data.case.status).toBe("NOTICE_ISSUED");
    caseVersion = notice.body.data.case.recordVersion;

    const corrected = await api
      .patch(`/api/v1/tenants/${tenant.tenantId}/rms/code-violations/${violationId}`)
      .set("If-Match", `W/"${violationVersion}"`)
      .send({ status: "CORRECTED" })
      .expect(200);
    violationVersion = corrected.body.data.recordVersion;

    const verified = await api
      .patch(`/api/v1/tenants/${tenant.tenantId}/rms/code-violations/${violationId}`)
      .set("If-Match", `W/"${violationVersion}"`)
      .send({ status: "VERIFIED", verificationNotes: "Exit inspected and clear." })
      .expect(200);
    expect(verified.body.data.status).toBe("VERIFIED");

    const closed = await api
      .patch(`/api/v1/tenants/${tenant.tenantId}/rms/code-cases/${caseId}`)
      .set("If-Match", `W/"${caseVersion}"`)
      .send({ status: "CLOSED" })
      .expect(200);
    expect(closed.body.data.status).toBe("CLOSED");
    expect(closed.body.data.closedAt).toBeTruthy();

    const detail = await api
      .get(`/api/v1/tenants/${tenant.tenantId}/rms/code-cases/${caseId}`)
      .expect(200);
    expect(detail.body.data.violations[0].status).toBe("VERIFIED");
    expect(detail.body.data.notices).toHaveLength(1);
  });

  it("enforces code enforcement tenant isolation through RLS", async () => {
    const tenantA = await harness.createTenant({ moduleCodes: ["CORE", "NERIS"] });
    const tenantB = await harness.createTenant({ moduleCodes: ["CORE", "NERIS"] });
    const userA = await createUser(tenantA.tenantId);
    const api = harness.api(userA.userId, tenantA.tenantId);

    const occupancy = await api
      .post(`/api/v1/tenants/${tenantA.tenantId}/rms/occupancies`)
      .set("Idempotency-Key", createId())
      .send({ name: "Tenant A Code Occupancy", status: "ACTIVE" })
      .expect(200);

    const created = await api
      .post(`/api/v1/tenants/${tenantA.tenantId}/rms/code-cases`)
      .set("Idempotency-Key", createId())
      .send({ occupancyId: occupancy.body.data.id, caseType: "COMPLAINT", status: "OPEN" })
      .expect(200);

    await expect(
      withTenantTransaction(harness.appDb, tenantB.tenantId, async (tx) =>
        tx.query.rmsCodeCases.findFirst({ where: eq(rmsCodeCases.id, created.body.data.id) }),
      ),
    ).resolves.toBeUndefined();
  });
});
