import { beforeEach, describe, expect, it, vi } from "vitest";
import { IndustrialBootstrapService } from "./industrial-bootstrap.service.js";

function principal(overrides: Record<string, unknown> = {}) {
  return {
    tenantId: "t1",
    isPlatformAdmin: false,
    permissions: new Set(["industrial.access"]),
    activeProducts: new Set(["FORGE_INDUSTRIAL"]),
    ...overrides,
  } as never;
}

describe("IndustrialBootstrapService", () => {
  const flags = { effective: vi.fn() };
  let service: IndustrialBootstrapService;

  beforeEach(() => {
    flags.effective.mockReset();
    flags.effective.mockResolvedValue([
      { key: "industrial.enabled", value: true },
      { key: "industrial.module.personnel.enabled", value: true },
      { key: "industrial.module.loto.enabled", value: true },
    ]);
    service = new IndustrialBootstrapService(flags as never);
  });

  it("returns CORE awsEnabled when industrial.enabled", async () => {
    const result = await service.bootstrap(principal());
    const core = result.modules.find((m) => m.code === "CORE");
    expect(core?.awsEnabled).toBe(true);
    expect(result.industrialEnabled).toBe(true);
  });

  it("maps LOCKOUT_TAGOUT to industrial.module.loto.enabled", async () => {
    const result = await service.bootstrap(principal());
    const loto = result.modules.find((m) => m.code === "LOCKOUT_TAGOUT");
    expect(loto?.featureFlagKey).toBe("industrial.module.loto.enabled");
    expect(loto?.awsEnabled).toBe(true);
  });
});
