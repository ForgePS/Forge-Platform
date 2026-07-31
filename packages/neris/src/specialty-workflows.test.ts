import { describe, expect, it } from "vitest";
import {
  CORE_INCIDENT_SECTION_KEYS,
  evaluateSpecialtyWorkflows,
  mapModuleToSpecialtySection,
} from "./specialty-workflows.js";

describe("specialty workflow engine", () => {
  it("keeps specialty groups optional until classification signals match", () => {
    const result = evaluateSpecialtyWorkflows({
      availableModuleKeys: ["mod_fire", "mod_structure_fire", "mod_outdoor_fire", "mod_hazard"],
      classificationSignals: [],
      fieldValuesByKey: {},
      specialtyWorkflowsEnabled: true,
    });

    const fire = result.groups.find((g) => g.id === "FIRE");
    expect(fire?.state).toBe("OPTIONAL");
    expect(result.navigationSectionKeys).not.toContain("FIRE");
    expect(result.navigationSectionKeys).toContain("OVERVIEW");
    expect(result.navigationSectionKeys).toContain("CLASSIFICATION");
  });

  it("activates fire and structure groups from classification signals", () => {
    const result = evaluateSpecialtyWorkflows({
      availableModuleKeys: ["mod_fire", "mod_structure_fire"],
      classificationSignals: ["STRUCTURE_FIRE"],
      fieldValuesByKey: {},
      specialtyWorkflowsEnabled: true,
    });

    expect(result.groups.find((g) => g.id === "FIRE")?.state).toBe("REQUIRED");
    expect(result.groups.find((g) => g.id === "STRUCTURE")?.state).toBe("REQUIRED");
    expect(result.navigationSectionKeys).toContain("FIRE");
    expect(result.navigationSectionKeys).toContain("STRUCTURE");
    expect(result.groups.find((g) => g.id === "FIRE")?.activationReasons.length).toBeGreaterThan(0);
  });

  it("respects not-applicable for optional groups only", () => {
    const result = evaluateSpecialtyWorkflows({
      availableModuleKeys: ["mod_exposure"],
      classificationSignals: ["EXPOSURE"],
      fieldValuesByKey: {},
      notApplicableSectionKeys: ["EXPOSURES"],
      specialtyWorkflowsEnabled: true,
    });
    expect(result.groups.find((g) => g.id === "EXPOSURES")?.state).toBe("NOT_APPLICABLE");
  });

  it("disables specialty navigation when feature flag is off", () => {
    const result = evaluateSpecialtyWorkflows({
      availableModuleKeys: ["mod_fire"],
      classificationSignals: ["FIRE"],
      fieldValuesByKey: {},
      specialtyWorkflowsEnabled: false,
    });
    expect(result.groups).toHaveLength(0);
    expect(result.navigationSectionKeys).toEqual([...CORE_INCIDENT_SECTION_KEYS]);
  });

  it("maps official modules to specialty sections", () => {
    expect(mapModuleToSpecialtySection("mod_outdoor_fire")).toBe("WILDLAND");
    expect(mapModuleToSpecialtySection("mod_hazsit")).toBe("HAZMAT");
    expect(mapModuleToSpecialtySection("mod_casualty_ff")).toBe("FIRE_SERVICE_CASUALTIES");
    expect(mapModuleToSpecialtySection("mod_incident")).toBeNull();
  });

  it("activates hazmat from field key signals without classification", () => {
    const result = evaluateSpecialtyWorkflows({
      availableModuleKeys: ["mod_hazsit"],
      classificationSignals: [],
      fieldValuesByKey: { un_number: "1203" },
      specialtyWorkflowsEnabled: true,
    });
    expect(result.groups.find((g) => g.id === "HAZMAT")?.state).toBe("REQUIRED");
    expect(result.navigationSectionKeys).toContain("HAZMAT");
  });

  it("forces optional groups active when manually added", () => {
    const result = evaluateSpecialtyWorkflows({
      availableModuleKeys: ["mod_emerging_hazard"],
      classificationSignals: [],
      fieldValuesByKey: {},
      forcedActiveSectionKeys: ["EMERGING_HAZARDS"],
      specialtyWorkflowsEnabled: true,
    });
    const emerging = result.groups.find((g) => g.id === "EMERGING_HAZARDS");
    expect(emerging?.state).toBe("ACTIVE");
    expect(emerging?.activationReasons).toContain("Manually added by user");
    expect(result.navigationSectionKeys).toContain("EMERGING_HAZARDS");
  });

  it("keeps specialty values concept when section is N/A (state only)", () => {
    const result = evaluateSpecialtyWorkflows({
      availableModuleKeys: ["mod_exposure"],
      classificationSignals: ["EXPOSURE"],
      fieldValuesByKey: { exposure_count: 2 },
      notApplicableSectionKeys: ["EXPOSURES"],
      specialtyWorkflowsEnabled: true,
    });
    expect(result.groups.find((g) => g.id === "EXPOSURES")?.state).toBe("NOT_APPLICABLE");
    expect(result.navigationSectionKeys).toContain("EXPOSURES");
  });
});
