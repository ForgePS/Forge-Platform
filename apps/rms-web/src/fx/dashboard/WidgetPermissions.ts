import type { DashboardWidgetDefinition } from "./types";

export function isWidgetAuthorized(
  widget: DashboardWidgetDefinition,
  input: {
    authenticated: boolean;
    flags: Record<string, boolean | undefined>;
  },
): boolean {
  if (!input.authenticated) return false;
  if (widget.featureFlag && !input.flags[widget.featureFlag]) return false;
  return true;
}

export function filterVisibleWidgets(
  widgets: DashboardWidgetDefinition[],
  input: {
    authenticated: boolean;
    flags: Record<string, boolean | undefined>;
  },
): DashboardWidgetDefinition[] {
  return widgets.filter((widget) => isWidgetAuthorized(widget, input));
}
