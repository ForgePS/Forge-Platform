import type { ComponentType } from "react";

export type WidgetSize = "1x1" | "2x1" | "2x2" | "3x2" | "4x2";
export type WidgetBreakpoint = "XS" | "SM" | "MD" | "LG" | "XL";
export type WidgetCategory =
  | "operational"
  | "queues"
  | "activity"
  | "status"
  | "quick-actions"
  | "notifications"
  | "reference";

export type DashboardWidgetDefinition = {
  id: string;
  title: string;
  description: string;
  category: WidgetCategory;
  /** Product capability flag key (platform), optional */
  featureFlag?: string;
  permission?: string;
  defaultSize: WidgetSize;
  minSize: WidgetSize;
  maxSize: WidgetSize;
  supportedBreakpoints: WidgetBreakpoint[];
  refreshable: boolean;
  defaultVisible: boolean;
  defaultOrder: number;
  component: ComponentType<DashboardWidgetComponentProps>;
};

export type DashboardWidgetComponentProps = {
  onRefreshRequest?: () => void;
  lastRefreshedAt?: string | null;
};

export type WidgetPreference = {
  id: string;
  visible: boolean;
  size: WidgetSize;
  order: number;
};

export type DashboardPreferencesState = {
  version: 1;
  widgets: WidgetPreference[];
};
