import { describe, expect, it } from "vitest";
import {
  buildCadIdempotencyKey,
  decideFieldOwnership,
  decideMatchOutcome,
  decideOutOfOrderAction,
  DEFAULT_CAD_MATCH_THRESHOLDS,
} from "./matching.js";

describe("decideMatchOutcome", () => {
  it("creates new when no candidates", () => {
    const result = decideMatchOutcome({
      score: 0,
      candidateIncidentIds: [],
      conflictingSourceIds: false,
      thresholds: DEFAULT_CAD_MATCH_THRESHOLDS,
      hasExactLink: false,
    });
    expect(result.outcome).toBe("CREATE_NEW");
  });

  it("forces review for conflicting source ids", () => {
    const result = decideMatchOutcome({
      score: 100,
      candidateIncidentIds: ["a"],
      conflictingSourceIds: true,
      thresholds: DEFAULT_CAD_MATCH_THRESHOLDS,
      hasExactLink: false,
    });
    expect(result.outcome).toBe("REQUIRES_REVIEW");
  });

  it("does not auto-merge multiple high-score candidates", () => {
    const result = decideMatchOutcome({
      score: 95,
      candidateIncidentIds: ["a", "b"],
      conflictingSourceIds: false,
      thresholds: DEFAULT_CAD_MATCH_THRESHOLDS,
      hasExactLink: false,
    });
    expect(result.outcome).toBe("REQUIRES_REVIEW");
  });

  it("updates existing on exact link", () => {
    const result = decideMatchOutcome({
      score: 50,
      candidateIncidentIds: ["a"],
      conflictingSourceIds: false,
      thresholds: DEFAULT_CAD_MATCH_THRESHOLDS,
      hasExactLink: true,
    });
    expect(result.outcome).toBe("UPDATE_EXISTING");
    expect(result.score).toBe(100);
  });
});

describe("buildCadIdempotencyKey", () => {
  it("is deterministic", () => {
    const a = buildCadIdempotencyKey({
      tenantId: "t1",
      connectionId: "c1",
      sourceMessageId: "m1",
      payloadHash: "abc",
    });
    const b = buildCadIdempotencyKey({
      tenantId: "t1",
      connectionId: "c1",
      sourceMessageId: "m1",
      payloadHash: "abc",
    });
    expect(a).toBe(b);
  });
});

describe("decideOutOfOrderAction", () => {
  it("rejects stale sequence without new information", () => {
    expect(
      decideOutOfOrderAction({
        incomingSequence: 2,
        lastAppliedSequence: 5,
        containsNewInformation: false,
      }),
    ).toBe("REJECT_STALE");
  });

  it("reviews stale sequence with new information", () => {
    expect(
      decideOutOfOrderAction({
        incomingSequence: 2,
        lastAppliedSequence: 5,
        containsNewInformation: true,
      }),
    ).toBe("REQUIRES_REVIEW");
  });
});

describe("decideFieldOwnership", () => {
  it("blocks finalized records with conflict", () => {
    expect(
      decideFieldOwnership({
        ownershipPolicy: "CAD_AUTHORITATIVE",
        forgeHasManualOverride: false,
        forgeIsFinalized: true,
        cadValuePresent: true,
      }),
    ).toBe("CREATE_CONFLICT");
  });

  it("keeps forge after manual edit under CAD_UNTIL_MANUAL_EDIT", () => {
    expect(
      decideFieldOwnership({
        ownershipPolicy: "CAD_UNTIL_MANUAL_EDIT",
        forgeHasManualOverride: true,
        forgeIsFinalized: false,
        cadValuePresent: true,
      }),
    ).toBe("KEEP_FORGE");
  });
});
