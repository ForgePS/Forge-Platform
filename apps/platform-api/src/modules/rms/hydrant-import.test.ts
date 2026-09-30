import { describe, expect, it } from "vitest";
import {
  buildHydrantImportReconciliation,
  classifyHydrantDuplicate,
  normalizeHydrantImportRecord,
} from "./hydrant-import.js";

describe("hydrant import normalization", () => {
  it("normalizes Forge Responder and Firestore-shaped hydrants", () => {
    const result = normalizeHydrantImportRecord({
      id: "legacy-hyd-3043",
      hydrantNumber: "HYD-3043",
      official_id: "3043-3043",
      address: "2600 Spahn Rd",
      lat: 38.2825,
      lng: -97.24,
      operationalStatus: "active",
      provider: "Northbridge Water",
      gpm: "731",
      staticPressure: "72",
      residualPressure: 54,
      flow_tests: [{ testDate: "2026-09-30", flowGpm: 731 }],
      inspection_history: [{ inspectionDate: "2026-09-29" }],
      damage_reports: [{ reportedAt: "2026-09-28T12:00:00Z" }],
    });
    expect(result.classification).toBe("READY");
    expect(result.mapped).toMatchObject({
      sourceHydrantId: "legacy-hyd-3043",
      displayId: "HYD-3043",
      officialHydrantId: "3043-3043",
      addressLine1: "2600 Spahn Rd",
      latitude: 38.2825,
      longitude: -97.24,
      status: "IN_SERVICE",
      waterProvider: "Northbridge Water",
      flowGpm: 731,
      staticPsi: 72,
      residualPsi: 54,
    });
    expect(result.mapped?.flowTests).toHaveLength(1);
    expect(result.mapped?.inspections).toHaveLength(1);
    expect(result.mapped?.damageReports).toHaveLength(1);
    expect(result.sourceHash).toHaveLength(64);
  });

  it("rejects partial coordinates instead of guessing", () => {
    const result = normalizeHydrantImportRecord({ id: "H-1", displayId: "H-1", latitude: 35.1 });
    expect(result.classification).toBe("INVALID");
    expect(result.issues.some((issue) => issue.code === "HYDRANT_IMPORT_PARTIAL_COORDINATES")).toBe(true);
  });

  it("classifies exact and proximity duplicates", () => {
    const normalized = normalizeHydrantImportRecord({ id: "old-1", displayId: "HYD-1", lat: 38.2825, lng: -97.24 });
    const incoming = normalized.mapped!;
    expect(classifyHydrantDuplicate(incoming, [{ id: "new-1", displayId: "HYD-1" }])).toMatchObject({classification:"DUPLICATE",existingId:"new-1"});
    expect(classifyHydrantDuplicate({...incoming,displayId:"OTHER"}, [{id:"new-2",displayId:"X",latitude:38.28251,longitude:-97.24001}])).toMatchObject({classification:"DUPLICATE",existingId:"new-2"});
  });

  it("forces manual review when identifiers are ambiguous", () => {
    const normalized = normalizeHydrantImportRecord({ id: "old-1", displayId: "HYD-1" });
    const result = classifyHydrantDuplicate(normalized.mapped!, [
      { id: "a", displayId: "HYD-1" },
      { id: "b", displayId: "HYD-1" },
    ]);
    expect(result.classification).toBe("AMBIGUOUS");
    expect(result.candidateIds).toEqual(["a","b"]);
  });

  it("builds reconciliation counts before execution", () => {
    const rows = [
      normalizeHydrantImportRecord({ id: "1", displayId: "NEW-1", address: "1 Main St" },0),
      normalizeHydrantImportRecord({ id: "2", displayId: "EXISTING" },1),
      normalizeHydrantImportRecord({ id: "3", displayId: "BAD", latitude: 10 },2),
    ];
    const report = buildHydrantImportReconciliation(rows,[{id:"existing-id",displayId:"EXISTING"}]);
    expect(report).toMatchObject({total:3,ready:1,duplicates:1,invalid:1,ambiguous:0});
  });
});
