import { describe, expect, it } from "vitest";
import {
  assertCommercialTransition,
  applyAllocationToInvoice,
  assertPaymentAllocations,
  COMMERCIAL_STATUS_TRANSITIONS,
  padSeq,
  prorateCents,
  recalculateInvoiceTotals,
  summarizeRecurringRevenue,
  entitlementStatusForAccessPolicy,
} from "./commercial-money.js";
import { ForgeError } from "@forge/errors";

describe("commercial status transitions", () => {
  it("allows DRAFT → ACTIVE and ACTIVE → SUSPENDED", () => {
    expect(() => assertCommercialTransition("DRAFT", "ACTIVE")).not.toThrow();
    expect(() => assertCommercialTransition("ACTIVE", "SUSPENDED")).not.toThrow();
    expect(() => assertCommercialTransition("SUSPENDED", "ACTIVE")).not.toThrow();
  });

  it("rejects CANCELLED → ACTIVE", () => {
    expect(() => assertCommercialTransition("CANCELLED", "ACTIVE")).toThrow(ForgeError);
  });

  it("defines terminal statuses with empty outs", () => {
    expect(COMMERCIAL_STATUS_TRANSITIONS.CANCELLED).toEqual([]);
    expect(COMMERCIAL_STATUS_TRANSITIONS.EXPIRED).toEqual([]);
  });
});

describe("invoice totals", () => {
  it("recalculates total and balance in integer cents", () => {
    const t = recalculateInvoiceTotals({
      subtotalCents: 10_000,
      discountCents: 1_000,
      taxCents: 500,
      creditCents: 200,
      amountPaidCents: 2_000,
    });
    // 10000 - 1000 + 500 - 200 = 9300; balance 7300
    expect(t.totalCents).toBe(9_300);
    expect(t.balanceCents).toBe(7_300);
    expect(t.status).toBe("PARTIALLY_PAID");
  });

  it("marks fully paid when balance is zero", () => {
    const t = recalculateInvoiceTotals({
      subtotalCents: 1000,
      amountPaidCents: 1000,
    });
    expect(t.balanceCents).toBe(0);
    expect(t.status).toBe("PAID");
  });
});

describe("payment allocation balance", () => {
  it("requires allocations to sum to payment", () => {
    expect(() =>
      assertPaymentAllocations(1000, [
        { invoiceId: "a", amountCents: 400 },
        { invoiceId: "b", amountCents: 600 },
      ]),
    ).not.toThrow();
    expect(() =>
      assertPaymentAllocations(1000, [{ invoiceId: "a", amountCents: 400 }]),
    ).toThrow(ForgeError);
  });

  it("updates invoice paid/balance/status", () => {
    const next = applyAllocationToInvoice({
      totalCents: 1000,
      amountPaidCents: 200,
      allocationCents: 300,
    });
    expect(next.amountPaidCents).toBe(500);
    expect(next.balanceCents).toBe(500);
    expect(next.status).toBe("PARTIALLY_PAID");

    const paid = applyAllocationToInvoice({
      totalCents: 1000,
      amountPaidCents: 500,
      allocationCents: 500,
    });
    expect(paid.status).toBe("PAID");
    expect(paid.balanceCents).toBe(0);
  });

  it("rejects over-allocation", () => {
    expect(() =>
      applyAllocationToInvoice({
        totalCents: 100,
        amountPaidCents: 80,
        allocationCents: 50,
      }),
    ).toThrow(ForgeError);
  });
});

describe("ARR / MRR", () => {
  it("sums recurring lines", () => {
    const { arrCents, mrrCents } = summarizeRecurringRevenue([
      { amountCents: 1000, billingFrequency: "MONTHLY" },
      { amountCents: 12_000, billingFrequency: "ANNUAL" },
    ]);
    expect(arrCents).toBe(12_000 + 12_000);
    expect(mrrCents).toBe(1000 + 1000);
  });
});

describe("proration", () => {
  it("DAILY prorates mid-period", () => {
    expect(
      prorateCents({
        amountCents: 3100,
        periodStart: "2026-01-01T00:00:00.000Z",
        periodEnd: "2026-02-01T00:00:00.000Z",
        effectiveFrom: "2026-01-16T00:00:00.000Z",
        method: "DAILY",
      }),
    ).toBe(1600);
  });
});

describe("sequence padding and access policy", () => {
  it("pads sequence numbers", () => {
    expect(padSeq(123)).toBe("0000123");
  });

  it("maps suspend access policies", () => {
    expect(entitlementStatusForAccessPolicy("SUSPENDED")).toEqual({
      moduleStatus: "GRACE",
      accessFlag: "SUSPENDED",
    });
    expect(entitlementStatusForAccessPolicy("READ_ONLY")).toEqual({
      moduleStatus: "ACTIVE",
      accessFlag: "READ_ONLY",
    });
  });
});
