import { describe, expect, it } from "vitest";
import { resolveRmsFxTablesFlag } from "./tables-flags";

describe("resolveRmsFxTablesFlag", () => {
  it("defaults off", () => {
    expect(resolveRmsFxTablesFlag({ apiEnabled: undefined, isPlatformAdmin: false })).toBe(false);
  });

  it("ignores platform admin wildcard", () => {
    expect(resolveRmsFxTablesFlag({ apiEnabled: true, isPlatformAdmin: true })).toBe(false);
  });

  it("enables for explicit tenant flag", () => {
    expect(resolveRmsFxTablesFlag({ apiEnabled: true, isPlatformAdmin: false })).toBe(true);
  });

  it("honors session override", () => {
    expect(
      resolveRmsFxTablesFlag({
        apiEnabled: false,
        isPlatformAdmin: false,
        sessionOverride: "1",
      }),
    ).toBe(true);
  });
});
