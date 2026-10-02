import type { RmsNavGroup, RmsNavigationItem } from "./navigation.types";
import { RMS_NAVIGATION_REGISTRY } from "./navigation.registry";

const GROUP_ORDER = ["home", "incidents", "operations", "training", "scheduling", "prevention", "water-supply", "cad", "neris", "session"] as const;

export function isNavItemVisible(
  item: RmsNavigationItem,
  flags: Record<string, boolean | undefined>,
  options?: { authenticated?: boolean },
): boolean {
  if (item.hidden) return false;
  if (item.id === "login" && options?.authenticated) return false;
  if (item.id === "select-tenant" && !options?.authenticated) return false;
  if (!item.featureFlag) return true;
  return Boolean(flags[item.featureFlag]);
}

export function filterNavigationItems(
  flags: Record<string, boolean | undefined>,
  options?: { authenticated?: boolean; includeSession?: boolean },
): RmsNavigationItem[] {
  return RMS_NAVIGATION_REGISTRY.filter((item) => {
    if (!options?.includeSession && item.group === "session") return false;
    return isNavItemVisible(item, flags, options);
  });
}

export function groupNavigationItems(items: RmsNavigationItem[]): RmsNavGroup[] {
  const groups: RmsNavGroup[] = [];
  for (const groupId of GROUP_ORDER) {
    const groupItems = items.filter((item) => item.group === groupId);
    if (groupItems.length === 0) continue;
    groups.push({
      id: groupId,
      label: groupItems[0]!.groupLabel,
      items: groupItems,
    });
  }
  return groups;
}

export function buildPrimaryNavigation(
  flags: Record<string, boolean | undefined>,
  options?: { authenticated?: boolean },
): RmsNavGroup[] {
  return groupNavigationItems(filterNavigationItems(flags, { ...options, includeSession: false }));
}

export function buildSecondaryNavigation(
  pathname: string,
  flags: Record<string, boolean | undefined>,
  options?: { authenticated?: boolean },
): RmsNavigationItem[] {
  const groups = buildPrimaryNavigation(flags, options);
  const activeGroup = groups.find((group) =>
    group.items.some(
      (item) =>
        pathname === item.path ||
        (!item.exact && pathname.startsWith(item.path.replace(/\/$/, ""))),
    ),
  );
  if (!activeGroup || activeGroup.id === "home") return [];
  return activeGroup.items;
}
