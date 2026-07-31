import { describe, expect, it } from "vitest";
import { resolveRmsFxWorkspaceFlag } from "./workspace-flags";

describe("resolveRmsFxWorkspaceFlag", () => {
  it("defaults off", () => {
    expect(
      resolveRmsFxWorkspaceFlag({
        apiEnabled: undefined,
        isPlatformAdmin: false,
      }),
    ).toBe(false);
  });

  it("ignores platform admin wildcard", () => {
    expect(
      resolveRmsFxWorkspaceFlag({
        apiEnabled: true,
        isPlatformAdmin: true,
      }),
    ).toBe(false);
  });

  it("enables for explicit tenant flag", () => {
    expect(
      resolveRmsFxWorkspaceFlag({
        apiEnabled: true,
        isPlatformAdmin: false,
      }),
    ).toBe(true);
  });

  it("honors env override for tests", () => {
    expect(
      resolveRmsFxWorkspaceFlag({
        apiEnabled: false,
        isPlatformAdmin: true,
        envOverride: "true",
      }),
    ).toBe(true);
  });

  it("honors session override", () => {
    expect(
      resolveRmsFxWorkspaceFlag({
        apiEnabled: false,
        isPlatformAdmin: false,
        sessionOverride: "1",
      }),
    ).toBe(true);
  });
});
