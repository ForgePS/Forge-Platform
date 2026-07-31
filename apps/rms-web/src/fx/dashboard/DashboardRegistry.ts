import type { DashboardWidgetDefinition } from "./types";

const registry = new Map<string, DashboardWidgetDefinition>();

export function registerDashboardWidget(definition: DashboardWidgetDefinition): void {
  if (registry.has(definition.id)) {
    throw new Error(`Dashboard widget already registered: ${definition.id}`);
  }
  registry.set(definition.id, definition);
}

export function getDashboardWidget(id: string): DashboardWidgetDefinition | undefined {
  return registry.get(id);
}

export function listDashboardWidgets(): DashboardWidgetDefinition[] {
  return Array.from(registry.values()).sort((a, b) => a.defaultOrder - b.defaultOrder);
}

export function listDashboardCategories(
  widgets: DashboardWidgetDefinition[],
): DashboardWidgetDefinition["category"][] {
  const seen = new Set<DashboardWidgetDefinition["category"]>();
  for (const widget of widgets) seen.add(widget.category);
  return Array.from(seen);
}

/** Test helper */
export function clearDashboardRegistryForTests(): void {
  registry.clear();
}
