import { describe, expect, it } from "vitest";
import { RMS_FEATURE_FLAGS } from "@/lib/constants";
import {
  buildPrimaryNavigation,
  buildSecondaryNavigation,
  filterNavigationItems,
} from "./navigation.adapter";
import { RMS_NAVIGATION_REGISTRY, RMS_NON_NAV_ROUTES } from "./navigation.registry";

describe("RMS navigation registry", () => {
  it("contains only verified live routes (no invented modules)", () => {
    const paths = RMS_NAVIGATION_REGISTRY.map((item) => item.path);
    expect(paths).not.toEqual(expect.arrayContaining(["/personnel/", "/prevention/", "/fleet/"]));
    expect(RMS_NAVIGATION_REGISTRY.some((item) => item.label === "Personnel")).toBe(false);
  });

  it("accounts for non-nav deep-link routes separately", () => {
    expect(RMS_NON_NAV_ROUTES.map((r) => r.path)).toEqual(
      expect.arrayContaining(["/auth/callback/", "/health/", "/incidents/[id]/"]),
    );
  });

  it("hides feature-flagged items when flags are off", () => {
    const items = filterNavigationItems({}, { authenticated: true });
    expect(items.every((item) => !item.featureFlag)).toBe(true);
    expect(items.some((item) => item.id === "home")).toBe(true);
  });

  it("shows incidents when product flag on", () => {
    const flags = { [RMS_FEATURE_FLAGS.incidentShell]: true };
    const groups = buildPrimaryNavigation(flags, { authenticated: true });
    const incidents = groups.find((group) => group.id === "incidents");
    expect(incidents?.items.some((item) => item.id === "incidents-list")).toBe(true);
  });

  it("builds secondary nav for active CAD group", () => {
    const flags = {
      [RMS_FEATURE_FLAGS.cadEnabled]: true,
      [RMS_FEATURE_FLAGS.cadOperations]: true,
    };
    const secondary = buildSecondaryNavigation("/cad/conflicts/", flags, { authenticated: true });
    expect(secondary.length).toBeGreaterThan(1);
    expect(secondary.every((item) => item.group === "cad")).toBe(true);
  });
});
