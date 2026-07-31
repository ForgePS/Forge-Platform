import { describe, expect, it } from "vitest";
import { resolveRmsFxFormsFlag } from "./forms-flags";

describe("resolveRmsFxFormsFlag", () => {
  it("defaults off", () => {
    expect(resolveRmsFxFormsFlag({ apiEnabled: undefined, isPlatformAdmin: false })).toBe(false);
  });

  it("ignores platform admin wildcard", () => {
    expect(resolveRmsFxFormsFlag({ apiEnabled: true, isPlatformAdmin: true })).toBe(false);
  });

  it("enables for explicit tenant flag", () => {
    expect(resolveRmsFxFormsFlag({ apiEnabled: true, isPlatformAdmin: false })).toBe(true);
  });

  it("honors env override", () => {
    expect(
      resolveRmsFxFormsFlag({
        apiEnabled: false,
        isPlatformAdmin: true,
        envOverride: "true",
      }),
    ).toBe(true);
  });
});
