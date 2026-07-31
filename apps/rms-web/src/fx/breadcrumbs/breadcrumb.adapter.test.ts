import { describe, expect, it } from "vitest";
import { buildBreadcrumbs } from "./breadcrumb.adapter";

describe("buildBreadcrumbs", () => {
  it("builds home-only crumb", () => {
    expect(buildBreadcrumbs("/")).toEqual([{ label: "Home" }]);
  });

  it("builds incident create crumbs", () => {
    expect(buildBreadcrumbs("/incidents/new/")).toEqual([
      { label: "Home", href: "/" },
      { label: "Incidents", href: "/incidents/" },
      { label: "Create" },
    ]);
  });

  it("builds CAD crumbs", () => {
    const crumbs = buildBreadcrumbs("/cad/mappings/");
    expect(crumbs.map((c) => c.label)).toEqual(["Home", "CAD", "Unit / Personnel"]);
  });
});
