import type { RmsNavigationItem } from "./navigation.types";

/** Permission hints are documentation / future client filters — backend remains authoritative. */
export function describeNavPermission(item: RmsNavigationItem): string | undefined {
  if (item.permission) return item.permission;
  if (item.permissionsAny?.length) return item.permissionsAny.join(" | ");
  return undefined;
}
