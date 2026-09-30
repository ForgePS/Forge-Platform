export type RmsNavGroupId = "home" | "incidents" | "water-supply" | "cad" | "neris" | "session";

export type RmsNavigationItem = {
  id: string;
  label: string;
  path: string;
  group: RmsNavGroupId;
  groupLabel: string;
  exact?: boolean;
  /** Product capability flag key (platform), not FX presentation flag */
  featureFlag?: string;
  /** Optional permission hint for documentation / future client filters */
  permission?: string;
  permissionsAny?: string[];
  hidden?: boolean;
  mobile?: boolean;
  children?: RmsNavigationItem[];
};

export type RmsNavGroup = {
  id: RmsNavGroupId;
  label: string;
  items: RmsNavigationItem[];
};
