import { describe, expect, it } from "vitest";
import { resolveRmsFxDashboardFlag } from "./dashboard-flags";

describe("resolveRmsFxDashboardFlag", () => {
  it("defaults off", () => {
    expect(
      resolveRmsFxDashboardFlag({
        apiEnabled: undefined,
        isPlatformAdmin: false,
      }),
    ).toBe(false);
  });

  it("ignores platform admin wildcard", () => {
    expect(
      resolveRmsFxDashboardFlag({
        apiEnabled: true,
        isPlatformAdmin: true,
      }),
    ).toBe(false);
  });

  it("enables for explicit tenant flag", () => {
    expect(
      resolveRmsFxDashboardFlag({
        apiEnabled: true,
        isPlatformAdmin: false,
      }),
    ).toBe(true);
  });

  it("honors env override for tests", () => {
    expect(
      resolveRmsFxDashboardFlag({
        apiEnabled: false,
        isPlatformAdmin: true,
        envOverride: "true",
      }),
    ).toBe(true);
  });
});
