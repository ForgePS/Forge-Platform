import { describe, expect, it } from "vitest";
import { INDUSTRIAL_MODULE_REGISTRY } from "@forge/contracts";
import { FIELD_ACTIONS } from "@/components/field-quick-bar";
import {
  INDUSTRIAL_JOURNEYS,
  inScopeJourneys,
  journeyById,
} from "./journeys";
import { buildIndustrialNavigation, featureFlagForModule } from "./navigation";
import { OPS_MODULE_CONFIG } from "./ops-modules";
import { COMPLIANCE_MODULE_CONFIG } from "./compliance-modules";

function registryRoute(code: string): string | undefined {
  return INDUSTRIAL_MODULE_REGISTRY.find((m) => m.code === code)?.route;
}

describe("Industrial E2E journey contracts", () => {
  it("marks Fleet OUT_OF_SCOPE", () => {
    const fleet = journeyById("fleet");
    expect(fleet?.outOfScope).toBe(true);
    expect(inScopeJourneys().some((j) => j.id === "fleet")).toBe(false);
  });

  it("covers required in-scope journeys", () => {
    const ids = inScopeJourneys().map((j) => j.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "personnel",
        "training",
        "incidents",
        "inspections",
        "loto",
        "workers-comp",
        "analytics",
        "mobile",
      ]),
    );
  });

  for (const journey of INDUSTRIAL_JOURNEYS.filter((j) => !j.outOfScope)) {
    it(`${journey.name}: routes resolve in registry or known aliases`, () => {
      for (const step of journey.steps) {
        if (!step.route) continue;
        const path = step.route.split("#")[0]!;
        const hit = INDUSTRIAL_MODULE_REGISTRY.some(
          (m) => m.route === path || m.route === `${path}/`,
        );
        const alias =
          path === "/modules/loto" ||
          path === "/modules/lockout-tagout" ||
          path === "/modules/workers-comp" ||
          path === "/modules/analytics";
        expect(hit || alias).toBe(true);
      }
    });
  }

  it("personnel journey has photo + profile steps", () => {
    const p = journeyById("personnel")!;
    expect(p.steps.map((s) => s.id)).toEqual(
      expect.arrayContaining(["photo", "profile", "add"]),
    );
  });

  it("training journey requires bulk multi-employee step", () => {
    expect(journeyById("training")!.steps.some((s) => s.id === "bulk")).toBe(true);
  });

  it("incident + inspection journeys require photo and CAPA/next-action", () => {
    expect(journeyById("incidents")!.steps.map((s) => s.id)).toEqual(
      expect.arrayContaining(["photo", "capa"]),
    );
    expect(journeyById("inspections")!.steps.map((s) => s.id)).toEqual(
      expect.arrayContaining(["photo", "capa"]),
    );
  });

  it("workers-comp journey requires sensitive permission verification", () => {
    expect(journeyById("workers-comp")!.steps.some((s) => s.id === "sensitive")).toBe(
      true,
    );
  });

  it("mobile journey covers field bar, filters, photo, overflow", () => {
    expect(journeyById("mobile")!.steps.map((s) => s.id)).toEqual(
      expect.arrayContaining(["field-bar", "filters", "photo", "overflow"]),
    );
  });
});

describe("Field quick actions wiring", () => {
  it("exposes incident, inspection, observation, LOTO", () => {
    expect(FIELD_ACTIONS.map((a) => a.id)).toEqual([
      "incident",
      "inspection",
      "observation",
      "loto",
    ]);
  });

  it("deep-links create flows with #ops-create where applicable", () => {
    expect(FIELD_ACTIONS.find((a) => a.id === "incident")!.href).toContain("#ops-create");
    expect(FIELD_ACTIONS.find((a) => a.id === "inspection")!.href).toContain("#ops-create");
  });
});

describe("Module configs support journey fields", () => {
  it("incidents/inspections include wizard photo modules fields", () => {
    expect(OPS_MODULE_CONFIG.incidents.createFields.some((f) => f.name === "title")).toBe(
      true,
    );
    expect(
      OPS_MODULE_CONFIG.inspections.createFields.some((f) => f.name === "correctiveAction"),
    ).toBe(true);
  });

  it("workers-comp remains sensitive-gated in compliance config", () => {
    expect(COMPLIANCE_MODULE_CONFIG["workers-comp"].sensitivePerm).toBeTruthy();
  });

  it("nav enables journey modules when flags on", () => {
    const flags: Record<string, boolean> = { "industrial.enabled": true };
    for (const code of ["PERSONNEL", "TRAINING", "INCIDENTS", "INSPECTIONS", "LOCKOUT_TAGOUT", "WORKERS_COMP", "ANALYTICS", "OBSERVATIONS"]) {
      flags[featureFlagForModule(code)] = true;
    }
    const nav = buildIndustrialNavigation({
      entitled: true,
      permissions: ["industrial.access"],
      flags,
    });
    for (const code of ["PERSONNEL", "INCIDENTS", "LOCKOUT_TAGOUT"]) {
      expect(nav.find((n) => n.code === code)?.available).toBe(true);
      expect(registryRoute(code)).toBeTruthy();
    }
  });
});
