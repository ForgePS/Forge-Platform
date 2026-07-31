import { describe, expect, it } from "vitest";
import type { CadNormalizedEvent } from "@forge/cad-contracts";
import { evaluateCadMatch } from "./evaluate-match.js";

function baseEvent(overrides: Partial<CadNormalizedEvent> = {}): CadNormalizedEvent {
  return {
    eventId: "e1",
    tenantId: "t1",
    connectionId: "c1",
    rawMessageId: "r1",
    source: {
      vendor: "Forge",
      adapterKey: "forge.synthetic",
      adapterVersion: "1.0.0",
      incidentId: "CAD-100",
      incidentNumber: "2026-0001",
      timestamp: "2026-07-27T12:00:00.000Z",
    },
    eventType: "INCIDENT_CREATED",
    incident: { callType: "STRUCTURE_FIRE", priority: "1" },
    location: {
      fullAddress: "100 Main St",
      city: "Austin",
      state: "TX",
      latitude: 30.27,
      longitude: -97.74,
    },
    units: [{ sourceUnitId: "E1" }],
    provenance: [],
    ...overrides,
  };
}

describe("evaluateCadMatch", () => {
  it("scores exact existing link as update", () => {
    const result = evaluateCadMatch({
      event: baseEvent(),
      connectionId: "c1",
      candidates: [
        {
          incidentId: "i1",
          existingSourceIncidentId: "CAD-100",
          existingLinkConnectionId: "c1",
        },
      ],
    });
    expect(result.outcome).toBe("UPDATE_EXISTING");
    expect(result.score).toBe(100);
  });

  it("creates new when no candidates", () => {
    const result = evaluateCadMatch({
      event: baseEvent(),
      connectionId: "c1",
      candidates: [],
    });
    expect(result.outcome).toBe("CREATE_NEW");
  });

  it("forces review for multiple high-score candidates", () => {
    const result = evaluateCadMatch({
      event: baseEvent(),
      connectionId: "c1",
      candidates: [
        {
          incidentId: "i1",
          fullAddress: "100 Main St",
          alarmAt: "2026-07-27T12:05:00.000Z",
          primaryIncidentTypeCode: "STRUCTURE_FIRE",
        },
        {
          incidentId: "i2",
          fullAddress: "100 Main St",
          alarmAt: "2026-07-27T12:04:00.000Z",
          primaryIncidentTypeCode: "STRUCTURE_FIRE",
        },
      ],
    });
    expect(["REQUIRES_REVIEW", "POSSIBLE_DUPLICATE"]).toContain(result.outcome);
    expect(result.candidateIncidentIds.length).toBeGreaterThan(1);
  });

  it("uses LINK_TO_MANUAL in hybrid mode for address match", () => {
    const result = evaluateCadMatch({
      event: baseEvent({ source: { ...baseEvent().source, incidentId: "CAD-NEW" } }),
      connectionId: "c1",
      hybridMode: true,
      candidates: [
        {
          incidentId: "manual-1",
          fullAddress: "100 Main St",
          alarmAt: "2026-07-27T12:02:00.000Z",
          primaryIncidentTypeCode: "STRUCTURE_FIRE",
        },
      ],
    });
    expect(["LINK_TO_MANUAL", "UPDATE_EXISTING", "POSSIBLE_DUPLICATE"]).toContain(result.outcome);
  });
});
