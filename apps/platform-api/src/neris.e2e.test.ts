import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createId, nerisFields } from "@forge/database";
import { importNerisSchema } from "@forge/database/neris-import";
import { E2eHarness, TEST_ADMIN_URL } from "./testing/e2e-harness.js";

describe("NERIS Phase 1 schema API", () => {
  const harness = new E2eHarness();

  beforeAll(async () => {
    await harness.init();
    await importNerisSchema({ databaseUrl: TEST_ADMIN_URL, publish: true });
  }, 360_000);

  afterAll(async () => {
    await harness.cleanup();
    await harness.close();
  });

  it("denies schema browser without permission", async () => {
    const tenant = await harness.createTenant();
    const user = await harness.createUser({
      tenantId: tenant.tenantId,
      email: `neris-noperm-${createId()}@example.test`,
      roleCode: "STANDARD_USER",
      rolePermissions: ["platform.person.read"],
    });

    const res = await harness
      .api(user.userId, user.tenantId)
      .get("/api/v1/platform/neris/modules")
      .expect(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("hides schema browser when feature flag is off (non-admin)", async () => {
    const tenant = await harness.createTenant();
    const user = await harness.createUser({
      tenantId: tenant.tenantId,
      email: `neris-flag-${createId()}@example.test`,
      roleCode: "NERIS_READER",
      rolePermissions: ["platform.neris.schema.read"],
    });

    const res = await harness
      .api(user.userId, user.tenantId)
      .get("/api/v1/platform/neris/modules")
      .expect(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
    expect(String(res.body.error.message)).toMatch(/schema browser/i);
  });

  it("platform admin can browse schema and list expected module count", async () => {
    const admin = await harness.createPlatformSuperAdmin();
    const res = await harness
      .api(admin.userId, admin.tenantId)
      .get("/api/v1/platform/neris/modules?pageSize=100")
      .expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta.total).toBe(39);
  });

  it("rejects overlay mutations that try to change official field keys", async () => {
    const tenant = await harness.createTenant();
    const user = await harness.createUser({
      tenantId: tenant.tenantId,
      email: `neris-overlay-${createId()}@example.test`,
      roleCode: "NERIS_OVERLAY",
      rolePermissions: ["platform.neris.overlay.read", "platform.neris.overlay.manage"],
    });
    const [field] = await harness.adminDb.select().from(nerisFields).limit(1);
    expect(field).toBeTruthy();

    const bad = await harness
      .api(user.userId, user.tenantId)
      .put(`/api/v1/tenants/${tenant.tenantId}/neris/field-overlays`)
      .send({ fieldId: field!.id, fieldKey: "hacked_key", displayLabel: "Nope" })
      .expect(400);
    expect(bad.body.error.code).toBe("BAD_REQUEST");

    const ok = await harness
      .api(user.userId, user.tenantId)
      .put(`/api/v1/tenants/${tenant.tenantId}/neris/field-overlays`)
      .send({ fieldId: field!.id, displayLabel: "Local label", favorite: true })
      .expect(200);
    expect(ok.body.data.displayLabel).toBe("Local label");
  });

  it("registry condition engine ping works for permitted reader under registry flag", async () => {
    const admin = await harness.createPlatformSuperAdmin();
    const res = await harness
      .api(admin.userId, admin.tenantId)
      .get("/api/v1/platform/neris/condition-engine/ping")
      .expect(200);
    expect(res.body.data.ok).toBe(true);
    expect(res.body.data.sampleVisible).toBe(true);
  });
});
