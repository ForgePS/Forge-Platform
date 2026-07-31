import { describe, expect, it } from "vitest";
import { evaluateSpecialtyWorkflows } from "@forge/neris";

describe("specialty workflows feature flag default", () => {
  it("hides specialty navigation when disabled (production-safe default)", () => {
    const result = evaluateSpecialtyWorkflows({
      availableModuleKeys: ["mod_fire", "mod_structure_fire"],
      classificationSignals: ["STRUCTURE_FIRE"],
      fieldValuesByKey: {},
      specialtyWorkflowsEnabled: false,
    });
    expect(result.groups).toHaveLength(0);
    expect(result.navigationSectionKeys).not.toContain("FIRE");
    expect(result.navigationSectionKeys).toContain("CLASSIFICATION");
  });

  it("activates specialty groups only when enabled", () => {
    const result = evaluateSpecialtyWorkflows({
      availableModuleKeys: ["mod_fire"],
      classificationSignals: ["FIRE"],
      fieldValuesByKey: {},
      specialtyWorkflowsEnabled: true,
    });
    expect(result.groups.find((g) => g.id === "FIRE")?.state).toBe("REQUIRED");
  });
});
