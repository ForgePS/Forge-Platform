import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createId, rmsInspections, withTenantTransaction } from "@forge/database";
import { eq } from "drizzle-orm";
import { E2eHarness } from "./testing/e2e-harness.js";

describe("RMS inspections domain", () => {
  const harness = new E2eHarness();

  beforeAll(async () => {
    await harness.init();
  }, 360_000);

  afterAll(async () => {
    await harness.cleanup();
    await harness.close();
  });

  async function createInspectionUser(tenantId: string) {
    return harness.createUser({
      tenantId,
      email: `inspection-${createId()}@example.test`,
      roleCode: "RMS_INSPECTION_MANAGER",
      rolePermissions: ["rms.masterdata.read", "rms.masterdata.manage"],
      moduleCodes: ["CORE", "NERIS"],
    });
  }

  it("creates and completes a persistent occupancy inspection", async () => {
    const tenant = await harness.createTenant({ moduleCodes: ["CORE", "NERIS"] });
    const user = await createInspectionUser(tenant.tenantId);
    const api = harness.api(user.userId, tenant.tenantId);

    const occupancy = await api
      .post(`/api/v1/tenants/${tenant.tenantId}/rms/occupancies`)
      .set("Idempotency-Key", createId())
      .send({
        name: "Inspection Test Warehouse",
        addressLine1: "100 Test Lane",
        city: "Northbridge",
        state: "KS",
        status: "ACTIVE",
      })
      .expect(200);

    const program = await api
      .post(`/api/v1/tenants/${tenant.tenantId}/rms/inspection-programs`)
      .set("Idempotency-Key", createId())
      .send({
        name: "Annual Fire Inspection",
        code: "ANNUAL",
        frequency: "Annual",
        active: true,
      })
      .expect(200);

    const template = await api
      .post(`/api/v1/tenants/${tenant.tenantId}/rms/inspection-templates`)
      .set("Idempotency-Key", createId())
      .send({
        programId: program.body.data.id,
        name: "Annual Fire Inspection v1",
        lifecycleStatus: "PUBLISHED",
        version: 1,
        sectionsJson: [
          {
            id: "life-safety",
            title: "Life Safety",
            fields: [
              { key: "exits_clear", label: "Exits clear", type: "pass_fail_na", severity: "HIGH" },
            ],
          },
        ],
      })
      .expect(200);

    const created = await api
      .post(`/api/v1/tenants/${tenant.tenantId}/rms/inspections`)
      .set("Idempotency-Key", createId())
      .send({
        occupancyId: occupancy.body.data.id,
        programId: program.body.data.id,
        templateId: template.body.data.id,
        inspectorName: "Test Inspector",
        inspectionDate: "2026-10-02",
        status: "IN_PROGRESS",
        overallResult: "PENDING",
      })
      .expect(200);

    const inspectionId = created.body.data.id as string;
    expect(created.body.data.checklistSnapshotJson).toHaveLength(1);

    await api
      .post(`/api/v1/tenants/${tenant.tenantId}/rms/inspections/${inspectionId}/responses`)
      .set("Idempotency-Key", createId())
      .send({
        sectionId: "life-safety",
        fieldKey: "exits_clear",
        fieldLabel: "Exits clear",
        result: "FAIL",
        comment: "Rear exit obstructed by storage.",
      })
      .expect(200);

    const finding = await api
      .post(`/api/v1/tenants/${tenant.tenantId}/rms/inspections/${inspectionId}/findings`)
      .set("Idempotency-Key", createId())
      .send({
        title: "Rear exit obstructed",
        severity: "HIGH",
        correctiveAction: "Remove stored material and maintain required egress width.",
        responsibleParty: "Occupancy manager",
        dueDate: "2026-10-09",
        status: "OPEN",
      })
      .expect(200);
    expect(finding.body.data.status).toBe("OPEN");

    const closed = await api
      .patch(`/api/v1/tenants/${tenant.tenantId}/rms/inspections/${inspectionId}`)
      .set("If-Match", `W/"${created.body.data.recordVersion}"`)
      .send({
        status: "COMPLETED",
        overallResult: "CONDITIONAL",
        followUpDate: "2026-10-09",
        notes: "Reinspection required for egress correction.",
      })
      .expect(200);

    expect(closed.body.data.status).toBe("COMPLETED");
    expect(closed.body.data.overallResult).toBe("CONDITIONAL");
    expect(closed.body.data.completedAt).toBeTruthy();

    const detail = await api
      .get(`/api/v1/tenants/${tenant.tenantId}/rms/inspections/${inspectionId}`)
      .expect(200);
    expect(detail.body.data.responses).toHaveLength(1);
    expect(detail.body.data.findings).toHaveLength(1);
    expect(detail.body.data.findings[0].dueDate).toBe("2026-10-09");
  });

  it("enforces inspection tenant isolation through RLS", async () => {
    const tenantA = await harness.createTenant({ moduleCodes: ["CORE", "NERIS"] });
    const tenantB = await harness.createTenant({ moduleCodes: ["CORE", "NERIS"] });
    const userA = await createInspectionUser(tenantA.tenantId);
    const apiA = harness.api(userA.userId, tenantA.tenantId);

    const occupancy = await apiA
      .post(`/api/v1/tenants/${tenantA.tenantId}/rms/occupancies`)
      .set("Idempotency-Key", createId())
      .send({ name: "Tenant A Occupancy", status: "ACTIVE" })
      .expect(200);

    const created = await apiA
      .post(`/api/v1/tenants/${tenantA.tenantId}/rms/inspections`)
      .set("Idempotency-Key", createId())
      .send({
        occupancyId: occupancy.body.data.id,
        inspectionDate: "2026-10-02",
        status: "IN_PROGRESS",
        overallResult: "PENDING",
      })
      .expect(200);

    await expect(
      withTenantTransaction(harness.appDb, tenantB.tenantId, async (tx) =>
        tx.query.rmsInspections.findFirst({ where: eq(rmsInspections.id, created.body.data.id) }),
      ),
    ).resolves.toBeUndefined();
  });
});
