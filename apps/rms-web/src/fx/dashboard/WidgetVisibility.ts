import { filterVisibleWidgets } from "./WidgetPermissions";
import type { DashboardWidgetDefinition, WidgetPreference } from "./types";

export function resolveVisibleWidgets(
  widgets: DashboardWidgetDefinition[],
  preferences: WidgetPreference[],
  auth: { authenticated: boolean; flags: Record<string, boolean | undefined> },
): Array<DashboardWidgetDefinition & { size: WidgetPreference["size"]; order: number }> {
  const authorized = filterVisibleWidgets(widgets, auth);
  const prefById = new Map(preferences.map((item) => [item.id, item]));
  return authorized
    .filter((widget) => prefById.get(widget.id)?.visible !== false)
    .map((widget) => {
      const pref = prefById.get(widget.id);
      return {
        ...widget,
        size: pref?.size ?? widget.defaultSize,
        order: pref?.order ?? widget.defaultOrder,
      };
    })
    .sort((a, b) => a.order - b.order);
}
