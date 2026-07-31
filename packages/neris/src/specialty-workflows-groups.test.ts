import { describe, expect, it } from "vitest";
import { SPECIALTY_WORKFLOW_GROUPS, evaluateSpecialtyWorkflows } from "./specialty-workflows.js";

const ALL_GROUP_IDS = [
  "FIRE",
  "STRUCTURE",
  "WILDLAND",
  "HAZMAT",
  "RESCUE",
  "EXPLOSION",
  "EXPOSURES",
  "CIVILIAN_CASUALTIES",
  "FIRE_SERVICE_CASUALTIES",
  "ALARM_DETECTION",
  "FIRE_PROTECTION",
  "EMERGING_HAZARDS",
  "RISK_REDUCTION",
  "INCIDENT_ANALYSIS",
] as const;

describe("specialty workflow groups", () => {
  it("defines all 14 workflow groups", () => {
    expect(SPECIALTY_WORKFLOW_GROUPS).toHaveLength(14);
    for (const id of ALL_GROUP_IDS) {
      expect(SPECIALTY_WORKFLOW_GROUPS.some((g) => g.id === id)).toBe(true);
    }
  });

  it("returns activation reasons for structure-fire signals when enabled", () => {
    const result = evaluateSpecialtyWorkflows({
      availableModuleKeys: ["mod_fire", "mod_structure_fire", "mod_exposures"],
      classificationSignals: ["FIRE", "STRUCTURE_FIRE"],
      fieldValuesByKey: {},
      specialtyWorkflowsEnabled: true,
    });
    const structure = result.groups.find((g) => g.id === "STRUCTURE");
    expect(structure?.state === "REQUIRED" || structure?.state === "ACTIVE").toBe(true);
    expect(structure?.activationReasons.length).toBeGreaterThan(0);
  });
});
