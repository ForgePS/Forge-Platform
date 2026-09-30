import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createId, rmsHydrants, withTenantTransaction } from "@forge/database";
import { eq } from "drizzle-orm";
import { E2eHarness } from "./testing/e2e-harness.js";

describe("RMS hydrant domain", () => {
  const harness = new E2eHarness();

  beforeAll(async () => {
    await harness.init();
  }, 360_000);

  afterAll(async () => {
    await harness.cleanup();
    await harness.close();
  });

  async function createHydrantUser(tenantId: string) {
    return harness.createUser({
      tenantId,
      email: `hydrant-${createId()}@example.test`,
      roleCode: "RMS_HYDRANT_MANAGER",
      rolePermissions: ["rms.masterdata.read", "rms.masterdata.manage"],
      moduleCodes: ["CORE", "NERIS"],
    });
  }

  it("creates, reads, updates, and flow-tests a tenant hydrant", async () => {
    const tenant = await harness.createTenant({ moduleCodes: ["CORE", "NERIS"] });
    const user = await createHydrantUser(tenant.tenantId);
    const api = harness.api(user.userId, tenant.tenantId);

    const created = await api
      .post(`/api/v1/tenants/${tenant.tenantId}/rms/hydrants`)
      .set("Idempotency-Key", createId())
      .send({
        displayId: "HYD-TEST-001",
        officialHydrantId: "3043-3043",
        locationId: "LOC-3043",
        district: "District 1",
        addressLine1: "2600 Spahn Rd",
        city: "Northbridge",
        state: "KS",
        latitude: 38.2825,
        longitude: -97.24,
        status: "IN_SERVICE",
        waterProvider: "Northbridge Water",
      })
      .expect(200);

    expect(created.body.data.displayId).toBe("HYD-TEST-001");
    const hydrantId = created.body.data.id as string;

    const flow = await api
      .post(`/api/v1/tenants/${tenant.tenantId}/rms/hydrants/${hydrantId}/flow-tests`)
      .set("Idempotency-Key", createId())
      .send({
        testDate: "2026-09-30",
        staticPsi: 72,
        residualPsi: 54,
        pitotPsi: 18,
        dischargeSize: 2.5,
        flowGpm: 731,
        flowResult: "PASS",
        nfpaClass: "Class B",
        nfpaColor: "Orange",
        testedBy: "Test Administrator",
        shift: "A",
        status: "IN_SERVICE",
      })
      .expect(200);

    expect(flow.body.data.flowTest.flowGpm).toBe(731);
    expect(flow.body.data.hydrant.flowGpm).toBe(731);
    expect(flow.body.data.hydrant.nfpaClass).toBe("Class B");

    const history = await api
      .get(`/api/v1/tenants/${tenant.tenantId}/rms/hydrants/${hydrantId}/flow-tests`)
      .expect(200);
    expect(history.body.data).toHaveLength(1);
    expect(history.body.data[0].pitotPsi).toBe(18);

    const inspection = await api
      .post(`/api/v1/tenants/${tenant.tenantId}/rms/hydrants/${hydrantId}/inspections`)
      .set("Idempotency-Key", createId())
      .send({ inspectionDate: "2026-09-30T12:00:00.000Z", operationalStatus: "NEEDS_REPAIR", inspector: "Test Inspector", checklist: { "Caps present and secure": false }, issueCount: 1, notes: "Cap requires attention" })
      .expect(200);
    expect(inspection.body.data.hydrant.status).toBe("NEEDS_REPAIR");

    const damage = await api
      .post(`/api/v1/tenants/${tenant.tenantId}/rms/hydrants/${hydrantId}/damage-reports`)
      .set("Idempotency-Key", createId())
      .send({ reportedAt: "2026-09-30T12:05:00.000Z", severity: "major", operationalStatus: "OUT_OF_SERVICE", leakPresent: true, trafficHazard: false, alternateWaterSupply: "HYD-TEST-002", reportedBy: "Test Administrator", notes: "Impact damage" })
      .expect(200);
    expect(damage.body.data.hydrant.status).toBe("OUT_OF_SERVICE");

    const inspections = await api.get(`/api/v1/tenants/${tenant.tenantId}/rms/hydrants/${hydrantId}/inspections`).expect(200);
    expect(inspections.body.data).toHaveLength(1);
    const damageReports = await api.get(`/api/v1/tenants/${tenant.tenantId}/rms/hydrants/${hydrantId}/damage-reports`).expect(200);
    expect(damageReports.body.data).toHaveLength(1);

    const list = await api
      .get(`/api/v1/tenants/${tenant.tenantId}/rms/hydrants?search=Spahn`)
      .expect(200);
    expect(list.body.data.some((row: { id: string }) => row.id === hydrantId)).toBe(true);
  });

  it("enforces hydrant tenant isolation through RLS", async () => {
    const tenantA = await harness.createTenant({ moduleCodes: ["CORE", "NERIS"] });
    const tenantB = await harness.createTenant({ moduleCodes: ["CORE", "NERIS"] });
    const userA = await createHydrantUser(tenantA.tenantId);
    const created = await harness
      .api(userA.userId, tenantA.tenantId)
      .post(`/api/v1/tenants/${tenantA.tenantId}/rms/hydrants`)
      .set("Idempotency-Key", createId())
      .send({ displayId: "HYD-ISOLATION", status: "IN_SERVICE" })
      .expect(200);

    await expect(
      withTenantTransaction(harness.appDb, tenantB.tenantId, async (tx) =>
        tx.query.rmsHydrants.findFirst({ where: eq(rmsHydrants.id, created.body.data.id) }),
      ),
    ).resolves.toBeUndefined();
  });
});
