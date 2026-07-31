import { beforeEach, describe, expect, it } from "vitest";
import { RMS_FEATURE_FLAGS } from "@/lib/constants";
import {
  clearDashboardRegistryForTests,
  listDashboardWidgets,
  registerDashboardWidget,
} from "./DashboardRegistry";
import { filterVisibleWidgets } from "./WidgetPermissions";
import { resolveVisibleWidgets } from "./WidgetVisibility";
import {
  ensureDashboardWidgetsRegistered,
  resetDashboardWidgetsForTests,
} from "./widgets/register-all";
import type { DashboardWidgetDefinition } from "./types";

describe("dashboard registry", () => {
  beforeEach(() => {
    clearDashboardRegistryForTests();
    resetDashboardWidgetsForTests();
  });

  it("registers only known live widgets", () => {
    ensureDashboardWidgetsRegistered();
    const ids = listDashboardWidgets().map((w) => w.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "quick-actions",
        "recent-incidents",
        "review-queue",
        "cad-status",
        "cad-conflicts",
        "my-work",
        "notifications",
        "system-status",
      ]),
    );
    expect(ids).not.toContain("personnel");
    expect(ids).not.toContain("prevention");
  });

  it("hides feature-flagged widgets when product flags are off", () => {
    const stub: DashboardWidgetDefinition = {
      id: "recent-incidents",
      title: "Recent",
      description: "d",
      category: "operational",
      featureFlag: RMS_FEATURE_FLAGS.incidentShell,
      defaultSize: "2x1",
      minSize: "1x1",
      maxSize: "2x1",
      supportedBreakpoints: ["MD"],
      refreshable: true,
      defaultVisible: true,
      defaultOrder: 1,
      component: () => null,
    };
    expect(filterVisibleWidgets([stub], { authenticated: true, flags: {} })).toHaveLength(0);
  });

  it("respects local preference visibility", () => {
    registerDashboardWidget({
      id: "system-status",
      title: "System",
      description: "d",
      category: "status",
      defaultSize: "1x1",
      minSize: "1x1",
      maxSize: "1x1",
      supportedBreakpoints: ["MD"],
      refreshable: false,
      defaultVisible: true,
      defaultOrder: 1,
      component: () => null,
    });
    const resolved = resolveVisibleWidgets(
      listDashboardWidgets(),
      [{ id: "system-status", visible: false, size: "1x1", order: 1 }],
      { authenticated: true, flags: {} },
    );
    expect(resolved).toHaveLength(0);
  });
});
