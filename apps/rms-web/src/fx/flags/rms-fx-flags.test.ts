import { describe, expect, it } from "vitest";
import { resolveRmsFxPresentationFlags } from "./rms-fx-flags";

describe("resolveRmsFxPresentationFlags", () => {
  it("defaults to legacy when all off", () => {
    const result = resolveRmsFxPresentationFlags({
      apiFlags: {},
      isPlatformAdmin: false,
    });
    expect(result).toMatchObject({
      shellEnabled: false,
      navigationEnabled: false,
      source: "legacy",
    });
  });

  it("does not auto-enable FX for platform admins", () => {
    const result = resolveRmsFxPresentationFlags({
      apiFlags: {
        "fx.rms.shell.enabled": true,
        "fx.rms.navigation.enabled": true,
      },
      isPlatformAdmin: true,
    });
    expect(result.source).toBe("legacy");
  });

  it("enables FX shell with legacy nav", () => {
    const result = resolveRmsFxPresentationFlags({
      apiFlags: { "fx.rms.shell.enabled": true },
      isPlatformAdmin: false,
    });
    expect(result).toMatchObject({
      shellEnabled: true,
      navigationEnabled: false,
      source: "fx-shell-legacy-nav",
    });
  });

  it("enables FX shell and FX navigation", () => {
    const result = resolveRmsFxPresentationFlags({
      apiFlags: {
        "fx.rms.shell.enabled": true,
        "fx.rms.navigation.enabled": true,
      },
      isPlatformAdmin: false,
    });
    expect(result.source).toBe("fx-shell-fx-nav");
  });

  it("rejects invalid nav-without-shell combo", () => {
    const result = resolveRmsFxPresentationFlags({
      apiFlags: { "fx.rms.navigation.enabled": true },
      isPlatformAdmin: false,
    });
    expect(result).toMatchObject({
      shellEnabled: false,
      navigationEnabled: false,
      invalidCombo: true,
      source: "legacy",
    });
  });

  it("honors env overrides for testing", () => {
    const result = resolveRmsFxPresentationFlags({
      apiFlags: {},
      isPlatformAdmin: true,
      envShell: "true",
      envNav: "true",
    });
    expect(result.source).toBe("fx-shell-fx-nav");
  });
});
