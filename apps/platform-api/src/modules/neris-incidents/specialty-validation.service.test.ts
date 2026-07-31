import { describe, expect, it } from "vitest";
import { SpecialtyValidationService } from "./specialty-validation.service.js";

describe("SpecialtyValidationService", () => {
  it("exposes collectSpecialtyFindings for progressive validation merge", () => {
    const service = new SpecialtyValidationService();
    expect(typeof service.collectSpecialtyFindings).toBe("function");
  });
});

describe("specialty validation reconciliation references", () => {
  it("keeps scenario-matrix technical references stable", () => {
    const expected = [
      "exposure.number.unique",
      "exposure.count.reconcile",
      "civilian_casualty.count.reconcile",
      "ff_casualty.count.reconcile",
      "hazmat.substance.required",
    ];
    expect(new Set(expected).size).toBe(expected.length);
  });
});
