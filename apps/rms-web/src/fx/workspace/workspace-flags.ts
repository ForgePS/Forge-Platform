/**
 * Workspace presentation flag — independent from shell / navigation / dashboard.
 * Default off; platform-admin wildcard must not auto-enable.
 */
export const RMS_FX_WORKSPACE_FLAG = "fx.rms.workspace.enabled";

export function resolveRmsFxWorkspaceFlag(input: {
  apiEnabled: boolean | undefined;
  isPlatformAdmin: boolean;
  envOverride?: string | undefined;
  sessionOverride?: string | null | undefined;
}): boolean {
  const envOn = input.envOverride === "true";
  const sessionOn = input.sessionOverride === "1" || input.sessionOverride === "true";
  if (envOn || sessionOn) return true;
  if (input.isPlatformAdmin) return false;
  return input.apiEnabled === true;
}
