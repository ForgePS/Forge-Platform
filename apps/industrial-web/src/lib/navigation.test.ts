import { describe, expect, it } from "vitest";
import {
  buildIndustrialNavigation,
  featureFlagForModule,
  moduleUnavailableMessage,
} from "./navigation";

describe("industrial navigation foundation", () => {
  it("returns empty nav when not entitled", () => {
    const nav = buildIndustrialNavigation({
      entitled: false,
      permissions: ["industrial.access"],
      flags: { "industrial.enabled": true },
    });
    expect(nav).toEqual([]);
  });

  it("keeps IND-3 modules unavailable when flags are off", () => {
    const nav = buildIndustrialNavigation({
      entitled: true,
      permissions: ["industrial.access"],
      flags: {},
    });
    const personnel = nav.find((n) => n.code === "PERSONNEL");
    expect(personnel?.available).toBe(false);
    expect(personnel?.migrationStatus).toBe("MIGRATION_IN_PROGRESS");
  });

  it("enables IND-3 module when flag on and access granted", () => {
    const nav = buildIndustrialNavigation({
      entitled: true,
      permissions: ["industrial.access"],
      flags: {
        "industrial.enabled": true,
        "industrial.module.personnel.enabled": true,
      },
    });
    const personnel = nav.find((n) => n.code === "PERSONNEL");
    expect(personnel?.available).toBe(true);
  });

  it("does not treat feature flags as authorization bypass", () => {
    const nav = buildIndustrialNavigation({
      entitled: true,
      permissions: [],
      flags: { "industrial.enabled": true, "industrial.module.personnel.enabled": true },
    });
    expect(nav).toEqual([]);
  });

  it("marks CORE as foundation-only available with industrial.access", () => {
    const nav = buildIndustrialNavigation({
      entitled: true,
      permissions: ["industrial.access"],
      flags: {},
    });
    const core = nav.find((n) => n.code === "CORE");
    expect(core?.available).toBe(true);
    expect(core?.migrationStatus).toBe("FOUNDATION_ONLY");
  });

  it("maps JSAS to industrial.module.jsa.enabled", () => {
    expect(featureFlagForModule("JSAS")).toBe("industrial.module.jsa.enabled");
  });

  it("preserves distinct Scan and QR Links entries", () => {
    const nav = buildIndustrialNavigation({
      entitled: true,
      permissions: ["industrial.access"],
      flags: {},
    });
    expect(nav.some((n) => n.code === "SCAN")).toBe(true);
    expect(nav.some((n) => n.code === "QR_LINKS")).toBe(true);
  });

  it("uses explicit unavailable messaging", () => {
    expect(moduleUnavailableMessage("Personnel", "MIGRATION_IN_PROGRESS")).toContain(
      "Ask a platform admin to enable it",
    );
    expect(moduleUnavailableMessage("Personnel")).toContain("not available in this environment");
  });
});
