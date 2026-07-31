/**
 * FX presentation flags for RMS shell/navigation.
 * Product capability flags remain in `@/lib/constants` (RMS_FEATURE_FLAGS).
 */
export const RMS_FX_FEATURE_FLAGS = {
  shell: "fx.rms.shell.enabled",
  navigation: "fx.rms.navigation.enabled",
  dashboard: "fx.rms.dashboard.enabled",
  workspace: "fx.rms.workspace.enabled",
  forms: "fx.rms.forms.enabled",
  tables: "fx.rms.tables.enabled",
  moduleIncidents: "fx.rms.module.incidents.enabled",
  moduleIncidentReview: "fx.rms.module.incidentReview.enabled",
  moduleCadMessages: "fx.rms.module.cadMessages.enabled",
  moduleCadConnections: "fx.rms.module.cadConnections.enabled",
  moduleCadConflicts: "fx.rms.module.cadConflicts.enabled",
  moduleNerisConfiguration: "fx.rms.module.nerisConfiguration.enabled",
  moduleAdministration: "fx.rms.module.administration.enabled",
  moduleUtilities: "fx.rms.module.utilities.enabled",
} as const;

export type RmsFxFlagKey = (typeof RMS_FX_FEATURE_FLAGS)[keyof typeof RMS_FX_FEATURE_FLAGS];

export type RmsFxPresentationFlags = {
  shellEnabled: boolean;
  navigationEnabled: boolean;
  /** true when nav requested without shell — forced to legacy nav */
  invalidCombo: boolean;
  source: "legacy" | "fx-shell-legacy-nav" | "fx-shell-fx-nav";
};

/**
 * Resolve FX presentation flags.
 * Platform-admin wildcard must NOT auto-enable FX presentation (default-off).
 * Explicit env / session overrides support local and automated testing.
 */
export function resolveRmsFxPresentationFlags(input: {
  apiFlags: Record<string, boolean | undefined>;
  isPlatformAdmin: boolean;
  envShell?: string | undefined;
  envNav?: string | undefined;
  sessionShell?: string | null | undefined;
  sessionNav?: string | null | undefined;
}): RmsFxPresentationFlags {
  const envShell = input.envShell === "true";
  const envNav = input.envNav === "true";
  const sessionShell = input.sessionShell === "1" || input.sessionShell === "true";
  const sessionNav = input.sessionNav === "1" || input.sessionNav === "true";

  let shell =
    envShell ||
    sessionShell ||
    (!input.isPlatformAdmin && input.apiFlags[RMS_FX_FEATURE_FLAGS.shell] === true);
  let nav =
    envNav ||
    sessionNav ||
    (!input.isPlatformAdmin && input.apiFlags[RMS_FX_FEATURE_FLAGS.navigation] === true);

  const invalidCombo = Boolean(nav && !shell);
  if (invalidCombo) {
    nav = false;
    shell = false;
  }

  if (!shell) {
    return {
      shellEnabled: false,
      navigationEnabled: false,
      invalidCombo,
      source: "legacy",
    };
  }

  if (!nav) {
    return {
      shellEnabled: true,
      navigationEnabled: false,
      invalidCombo: false,
      source: "fx-shell-legacy-nav",
    };
  }

  return {
    shellEnabled: true,
    navigationEnabled: true,
    invalidCombo: false,
    source: "fx-shell-fx-nav",
  };
}
