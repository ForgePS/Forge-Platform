import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createId, rmsEquipment, rmsInventoryItems, withTenantTransaction } from "@forge/database";
import { eq } from "drizzle-orm";
import { E2eHarness } from "./testing/e2e-harness.js";

describe("RMS equipment and inventory domain", () => {
  const harness = new E2eHarness();

  beforeAll(async () => {
    await harness.init();
  }, 360_000);

  afterAll(async () => {
    await harness.cleanup();
    await harness.close();
  });

  async function createManager(tenantId: string) {
    return harness.createUser({
      tenantId,
      email: `inventory-${createId()}@example.test`,
      roleCode: "RMS_INVENTORY_MANAGER",
      rolePermissions: ["rms.masterdata.read", "rms.masterdata.manage"],
      moduleCodes: ["CORE", "NERIS"],
    });
  }

  it("tracks equipment assignments, meters, and inventory balances", async () => {
    const tenant = await harness.createTenant({ moduleCodes: ["CORE", "NERIS"] });
    const user = await createManager(tenant.tenantId);
    const api = harness.api(user.userId, tenant.tenantId);

    const equipment = await api
      .post(`/api/v1/tenants/${tenant.tenantId}/rms/equipment`)
      .set("Idempotency-Key", createId())
      .send({
        assetTag: "EQ-001",
        name: "Portable Generator",
        category: "POWER",
        manufacturer: "Synthetic",
        model: "GEN-5000",
        status: "IN_SERVICE",
      })
      .expect(200);

    const equipmentId = equipment.body.data.id as string;

    await api
      .patch(`/api/v1/tenants/${tenant.tenantId}/rms/equipment/${equipmentId}`)
      .set("If-Match", `W/"${equipment.body.data.recordVersion}"`)
      .send({ storageLocation: "Bypass history" })
      .expect(400);

    const assignment = await api
      .post(`/api/v1/tenants/${tenant.tenantId}/rms/equipment/${equipmentId}/assignments`)
      .set("Idempotency-Key", createId())
      .send({
        assignmentType: "STORAGE",
        storageLocation: "Station 1 Equipment Room",
        assignedAt: "2026-10-01T09:00:00.000Z",
      })
      .expect(200);

    expect(assignment.body.data.equipment.storageLocation).toBe("Station 1 Equipment Room");

    const meter = await api
      .post(`/api/v1/tenants/${tenant.tenantId}/rms/equipment/${equipmentId}/meter-readings`)
      .set("Idempotency-Key", createId())
      .send({
        meterType: "ENGINE_HOURS",
        reading: 128.4,
        recordedAt: "2026-10-01T09:05:00.000Z",
        source: "MANUAL",
      })
      .expect(200);

    expect(meter.body.data.reading).toBe(128.4);

    const item = await api
      .post(`/api/v1/tenants/${tenant.tenantId}/rms/inventory`)
      .set("Idempotency-Key", createId())
      .send({
        itemCode: "MED-GLOVE-L",
        name: "Nitrile Gloves Large",
        category: "EMS_SUPPLY",
        unitOfMeasure: "BOX",
        storageLocation: "Station 1 EMS Closet",
        currentQuantity: 10,
        minimumQuantity: 4,
        targetQuantity: 12,
      })
      .expect(200);

    const itemId = item.body.data.id as string;

    await api
      .patch(`/api/v1/tenants/${tenant.tenantId}/rms/inventory/${itemId}`)
      .set("If-Match", `W/"${item.body.data.recordVersion}"`)
      .send({ currentQuantity: 999 })
      .expect(400);

    const issue = await api
      .post(`/api/v1/tenants/${tenant.tenantId}/rms/inventory/${itemId}/transactions`)
      .set("Idempotency-Key", createId())
      .send({
        transactionType: "ISSUE",
        quantityDelta: -3,
        occurredAt: "2026-10-01T09:10:00.000Z",
        reason: "Restock medic unit",
      })
      .expect(200);

    expect(issue.body.data.inventoryItem.currentQuantity).toBe(7);
    expect(issue.body.data.transaction.quantityAfter).toBe(7);

    await api
      .post(`/api/v1/tenants/${tenant.tenantId}/rms/inventory/${itemId}/transactions`)
      .set("Idempotency-Key", createId())
      .send({
        transactionType: "ISSUE",
        quantityDelta: -10,
        occurredAt: "2026-10-01T09:15:00.000Z",
      })
      .expect(400);

    const receive = await api
      .post(`/api/v1/tenants/${tenant.tenantId}/rms/inventory/${itemId}/transactions`)
      .set("Idempotency-Key", createId())
      .send({
        transactionType: "RECEIVE",
        quantityDelta: 5,
        occurredAt: "2026-10-01T09:20:00.000Z",
        referenceType: "PURCHASE_ORDER",
        referenceId: "PO-1001",
      })
      .expect(200);

    expect(receive.body.data.inventoryItem.currentQuantity).toBe(12);

    const transactions = await api
      .get(`/api/v1/tenants/${tenant.tenantId}/rms/inventory/${itemId}/transactions`)
      .expect(200);

    expect(transactions.body.data).toHaveLength(3);
    expect(transactions.body.data[0].quantityAfter).toBe(12);
    expect(
      transactions.body.data.some((row: { reason?: string | null }) => row.reason === "Opening balance"),
    ).toBe(true);

    const assignments = await api
      .get(`/api/v1/tenants/${tenant.tenantId}/rms/equipment/${equipmentId}/assignments`)
      .expect(200);
    expect(assignments.body.data).toHaveLength(1);

    const readings = await api
      .get(`/api/v1/tenants/${tenant.tenantId}/rms/equipment/${equipmentId}/meter-readings`)
      .expect(200);
    expect(readings.body.data).toHaveLength(1);
  });

  it("enforces equipment and inventory tenant isolation through RLS", async () => {
    const tenantA = await harness.createTenant({ moduleCodes: ["CORE", "NERIS"] });
    const tenantB = await harness.createTenant({ moduleCodes: ["CORE", "NERIS"] });
    const userA = await createManager(tenantA.tenantId);
    const apiA = harness.api(userA.userId, tenantA.tenantId);

    const equipment = await apiA
      .post(`/api/v1/tenants/${tenantA.tenantId}/rms/equipment`)
      .set("Idempotency-Key", createId())
      .send({ assetTag: "EQ-ISOLATION", name: "Isolation Tool", category: "TOOLS" })
      .expect(200);

    const item = await apiA
      .post(`/api/v1/tenants/${tenantA.tenantId}/rms/inventory`)
      .set("Idempotency-Key", createId())
      .send({ itemCode: "INV-ISOLATION", name: "Isolation Supply", storageLocation: "General" })
      .expect(200);

    await expect(
      withTenantTransaction(harness.appDb, tenantB.tenantId, async (tx) =>
        tx.query.rmsEquipment.findFirst({ where: eq(rmsEquipment.id, equipment.body.data.id) }),
      ),
    ).resolves.toBeUndefined();

    await expect(
      withTenantTransaction(harness.appDb, tenantB.tenantId, async (tx) =>
        tx.query.rmsInventoryItems.findFirst({ where: eq(rmsInventoryItems.id, item.body.data.id) }),
      ),
    ).resolves.toBeUndefined();
  });
});
