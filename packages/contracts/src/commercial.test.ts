import { describe, expect, it } from "vitest";
import {
  addCents,
  assertNonNegativeCents,
  commercialStatusLabel,
  computeArrCents,
  computeMrrCents,
  divideCentsHalfUp,
  formatUsd,
  percentOfCents,
  prorateCents,
  subtractCents,
} from "./commercial.js";

describe("commercialStatusLabel", () => {
  it("returns human labels for known statuses", () => {
    expect(commercialStatusLabel("ACTIVE")).toBe("Active");
    expect(commercialStatusLabel("PAST_DUE")).toBe("Past due");
    expect(commercialStatusLabel("CANCEL_SCHEDULED")).toBe("Cancel scheduled");
  });

  it("returns the raw string for unknown statuses", () => {
    expect(commercialStatusLabel("SOMETHING_NEW")).toBe("SOMETHING_NEW");
  });
});

describe("money helpers", () => {
  it("assertNonNegativeCents rejects negatives and non-integers", () => {
    expect(() => assertNonNegativeCents(-1)).toThrow(/non-negative/);
    expect(() => assertNonNegativeCents(1.5)).toThrow(/integer/);
    expect(() => assertNonNegativeCents(0)).not.toThrow();
  });

  it("formatUsd formats cents as USD", () => {
    expect(formatUsd(0)).toBe("$0.00");
    expect(formatUsd(1)).toBe("$0.01");
    expect(formatUsd(1234)).toBe("$12.34");
    expect(formatUsd(1_000_00)).toBe("$1,000.00");
  });

  it("addCents and subtractCents", () => {
    expect(addCents(100, 50)).toBe(150);
    expect(subtractCents(100, 40)).toBe(60);
    expect(() => subtractCents(10, 20)).toThrow(/negative/);
  });

  it("divideCentsHalfUp rounds half up", () => {
    expect(divideCentsHalfUp(5, 2)).toBe(3);
    expect(divideCentsHalfUp(4, 2)).toBe(2);
    expect(divideCentsHalfUp(1, 3)).toBe(0);
    expect(divideCentsHalfUp(2, 3)).toBe(1);
  });

  it("percentOfCents uses basis points with half-up", () => {
    expect(percentOfCents(10_000, 2500)).toBe(2500);
    // 33.33% of 100 = 33.33 → 33 with half-up from 3333/10000 * 100
    expect(percentOfCents(100, 3333)).toBe(33);
    // exactly half: 1 * 5000 / 10000 = 0.5 → 1
    expect(percentOfCents(1, 5000)).toBe(1);
  });
});

describe("ARR / MRR", () => {
  it("computes ARR from recurring amount and frequency", () => {
    expect(computeArrCents(1000, "MONTHLY")).toBe(12_000);
    expect(computeArrCents(3000, "QUARTERLY")).toBe(12_000);
    expect(computeArrCents(6000, "SEMI_ANNUAL")).toBe(12_000);
    expect(computeArrCents(12_000, "ANNUAL")).toBe(12_000);
    expect(computeArrCents(12_000, "CUSTOM")).toBe(12_000);
  });

  it("computes MRR with half-up division", () => {
    expect(computeMrrCents(1000, "MONTHLY")).toBe(1000);
    expect(computeMrrCents(3000, "QUARTERLY")).toBe(1000);
    expect(computeMrrCents(6000, "SEMI_ANNUAL")).toBe(1000);
    expect(computeMrrCents(12_000, "ANNUAL")).toBe(1000);
    // 100 / 12 = 8.333… → 8
    expect(computeMrrCents(100, "ANNUAL")).toBe(8);
    // 6 / 12 = 0.5 → 1
    expect(computeMrrCents(6, "ANNUAL")).toBe(1);
  });
});

describe("prorateCents", () => {
  const periodStart = "2026-01-01T00:00:00.000Z";
  const periodEnd = "2026-02-01T00:00:00.000Z"; // 31 days

  it("NONE returns full amount", () => {
    expect(
      prorateCents({
        amountCents: 3100,
        periodStart,
        periodEnd,
        effectiveFrom: "2026-01-15T00:00:00.000Z",
        method: "NONE",
      }),
    ).toBe(3100);
  });

  it("NEXT_CYCLE returns zero", () => {
    expect(
      prorateCents({
        amountCents: 3100,
        periodStart,
        periodEnd,
        effectiveFrom: "2026-01-15T00:00:00.000Z",
        method: "NEXT_CYCLE",
      }),
    ).toBe(0);
  });

  it("DAILY prorates remaining days with half-up", () => {
    // 16 remaining days of 31 (Jan 16..Jan 31 inclusive-exclusive → 16 days)
    // Jan 16 to Feb 1 = 16 days; 3100 * 16 / 31 = 1600 exactly
    expect(
      prorateCents({
        amountCents: 3100,
        periodStart,
        periodEnd,
        effectiveFrom: "2026-01-16T00:00:00.000Z",
        method: "DAILY",
      }),
    ).toBe(1600);
  });

  it("DAILY returns full amount when effectiveFrom is at period start", () => {
    expect(
      prorateCents({
        amountCents: 3100,
        periodStart,
        periodEnd,
        effectiveFrom: periodStart,
        method: "DAILY",
      }),
    ).toBe(3100);
  });

  it("DAILY returns zero when effectiveFrom is at or after period end", () => {
    expect(
      prorateCents({
        amountCents: 3100,
        periodStart,
        periodEnd,
        effectiveFrom: periodEnd,
        method: "DAILY",
      }),
    ).toBe(0);
  });
});
