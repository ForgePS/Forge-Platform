import { beforeEach, describe, expect, it, vi } from "vitest";
import { INDUSTRIAL_PRODUCT_CODE } from "@forge/contracts";
import { ForgeError } from "@forge/errors";
import type { ForgePrincipal } from "@forge/tenant-context";
import { IndustrialService } from "./industrial.service.js";

function principal(overrides: Partial<ForgePrincipal> = {}): ForgePrincipal {
  return {
    authenticationIdentityId: "aid",
    userId: "11111111-1111-4111-8111-111111111111",
    personId: null,
    tenantId: "22222222-2222-4222-8222-222222222222",
    organizationIds: [],
    permissions: new Set(["industrial.access"]),
    activeProducts: new Set([INDUSTRIAL_PRODUCT_CODE]),
    activeModules: new Set(["CORE"]),
    correlationId: "corr-1",
    requestId: "req-1",
    authProvider: "COGNITO",
    isPlatformAdmin: false,
    ...overrides,
  };
}

describe("IndustrialService", () => {
  let flags: { effective: ReturnType<typeof vi.fn> };
  let service: IndustrialService;

  beforeEach(() => {
    flags = {
      effective: vi.fn(async () => [
        { key: "industrial.enabled", value: true },
        { key: "industrial.module.personnel.enabled", value: false },
      ]),
    };
    service = new IndustrialService(flags as never);
  });

  it("bootstrap returns CORE awsEnabled when entitled and industrial.enabled", async () => {
    const result = await service.bootstrap(principal());
    expect(result.productCode).toBe(INDUSTRIAL_PRODUCT_CODE);
    expect(result.industrialEnabled).toBe(true);
    expect(result.entitled).toBe(true);
    const core = result.modules.find((m) => m.code === "CORE");
    expect(core?.awsEnabled).toBe(true);
    expect(core?.featureFlagKey).toBe("industrial.enabled");
  });

  it("bootstrap keeps PERSONNEL awsEnabled false when module flag is off", async () => {
    const result = await service.bootstrap(principal());
    const personnel = result.modules.find((m) => m.code === "PERSONNEL");
    expect(personnel?.awsEnabled).toBe(false);
  });

  it("bootstrap sets PERSONNEL awsEnabled when module flag is on", async () => {
    flags.effective = vi.fn(async () => [
      { key: "industrial.enabled", value: true },
      { key: "industrial.module.personnel.enabled", value: true },
    ]);
    const result = await service.bootstrap(principal());
    const personnel = result.modules.find((m) => m.code === "PERSONNEL");
    expect(personnel?.awsEnabled).toBe(true);
    expect(result.flags["industrial.module.personnel.enabled"]).toBe(true);
  });

  it("bootstrap maps LOCKOUT_TAGOUT to industrial.module.loto.enabled", async () => {
    const result = await service.bootstrap(principal());
    const loto = result.modules.find((m) => m.code === "LOCKOUT_TAGOUT");
    expect(loto?.featureFlagKey).toBe("industrial.module.loto.enabled");
  });

  it("bootstrap rejects when industrial.access is missing", async () => {
    await expect(
      service.bootstrap(principal({ permissions: new Set() })),
    ).rejects.toBeInstanceOf(ForgeError);
  });

  it("bootstrap rejects when product is not entitled", async () => {
    await expect(
      service.bootstrap(principal({ activeProducts: new Set() })),
    ).rejects.toBeInstanceOf(ForgeError);
  });

  it("bootstrap allows platform admin without entitlement", async () => {
    const result = await service.bootstrap(
      principal({
        isPlatformAdmin: true,
        activeProducts: new Set(),
        permissions: new Set(),
      }),
    );
    expect(result.entitled).toBe(true);
    expect(result.industrialEnabled).toBe(true);
  });

  it("readiness returns ready when industrial.enabled", async () => {
    const result = await service.readiness(principal());
    expect(result).toEqual({
      status: "ready",
      productCode: INDUSTRIAL_PRODUCT_CODE,
      industrialEnabled: true,
      entitled: true,
    });
  });

  it("readiness returns disabled when not entitled", async () => {
    const result = await service.readiness(
      principal({ activeProducts: new Set(), permissions: new Set(["industrial.access"]) }),
    );
    expect(result.status).toBe("disabled");
    expect(result.entitled).toBe(false);
    expect(result.industrialEnabled).toBe(false);
  });
});
