import type { WorkspaceDefinition, WorkspaceTabDefinition } from "./types";

export type WorkspaceAuthContext = {
  authenticated: boolean;
  tenantId?: string | null;
  permissionCodes?: string[];
  entitlements?: Record<string, boolean>;
  featureFlags?: Record<string, boolean | undefined>;
  workspaceFlagEnabled: boolean;
};

export function isWorkspaceAuthorized(
  def: WorkspaceDefinition,
  ctx: WorkspaceAuthContext,
): boolean {
  if (!ctx.authenticated) return false;
  if (!ctx.tenantId) return false;
  if (!ctx.workspaceFlagEnabled) return false;
  if (ctx.featureFlags?.[def.featureFlag] === false) return false;
  if (def.permissions?.length) {
    const codes = new Set(ctx.permissionCodes ?? []);
    if (!def.permissions.every((p) => codes.has(p))) return false;
  }
  return true;
}

export function filterAuthorizedTabs(
  tabs: WorkspaceTabDefinition[],
  ctx: Pick<WorkspaceAuthContext, "permissionCodes" | "featureFlags">,
): WorkspaceTabDefinition[] {
  return tabs.filter((tab) => {
    if (tab.featureFlag && ctx.featureFlags?.[tab.featureFlag] === false) return false;
    if (tab.permissions?.length) {
      const codes = new Set(ctx.permissionCodes ?? []);
      if (!tab.permissions.every((p) => codes.has(p))) return false;
    }
    return true;
  });
}
