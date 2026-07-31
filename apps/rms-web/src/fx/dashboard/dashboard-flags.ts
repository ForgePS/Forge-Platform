/**
 * Dashboard presentation flag — independent from shell/navigation.
 * Default off; platform-admin wildcard must not auto-enable.
 */
export const RMS_FX_DASHBOARD_FLAG = "fx.rms.dashboard.enabled";

export function resolveRmsFxDashboardFlag(input: {
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
