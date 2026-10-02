import { describe, expect, it } from "vitest";
import { RMS_FEATURE_FLAGS } from "@/lib/constants";
import {
  buildPrimaryNavigation,
  buildSecondaryNavigation,
  filterNavigationItems,
} from "./navigation.adapter";
import { RMS_NAVIGATION_REGISTRY, RMS_NON_NAV_ROUTES } from "./navigation.registry";

describe("RMS navigation registry", () => {
  it("contains only verified live routes and no duplicate ids", () => {
    const paths = RMS_NAVIGATION_REGISTRY.map((item) => item.path);
    const ids = RMS_NAVIGATION_REGISTRY.map((item) => item.id);
    expect(paths).not.toEqual(expect.arrayContaining(["/prevention/", "/fleet/"]));
    expect(new Set(ids).size).toBe(ids.length);
    expect(RMS_NAVIGATION_REGISTRY.some((item) => item.path === "/personnel/")).toBe(true);
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

  it("exposes native Operations personnel apparatus and unit routes", () => {
    const groups = buildPrimaryNavigation({}, { authenticated: true });
    const operations = groups.find((group) => group.id === "operations");
    expect(operations?.items.map((item) => item.id)).toEqual(
      expect.arrayContaining(["personnel-list", "personnel-new", "apparatus-list", "units-list", "stations-list", "shifts-list", "rosters-list"]),
    );
  });

  it("exposes native Prevention occupancy and preplan routes", () => {
    const groups = buildPrimaryNavigation({}, { authenticated: true });
    const prevention = groups.find((group) => group.id === "prevention");
    expect(prevention?.items.map((item) => item.id)).toEqual(
      expect.arrayContaining(["occupancies-list", "occupancies-new", "inspections-list", "inspections-new", "preplans-list", "preplans-new"]),
    );
  });

  it("exposes native hydrants under Water Supply", () => {
    const groups = buildPrimaryNavigation({}, { authenticated: true });
    const waterSupply = groups.find((group) => group.id === "water-supply");
    expect(waterSupply?.label).toBe("Water Supply");
    expect(waterSupply?.items.map((item) => item.id)).toEqual(
      expect.arrayContaining(["hydrants", "hydrants-new"]),
    );
    expect(waterSupply?.items.find((item) => item.id === "hydrants")?.permission).toBe(
      "rms.masterdata.read",
    );
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
