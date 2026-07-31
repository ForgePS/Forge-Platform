/**
 * FX-S2F operational module flags — independent, default-off.
 * Module flags never force foundation flags on.
 */
export const RMS_FX_MODULE_FLAGS = {
  incidents: "fx.rms.module.incidents.enabled",
  incidentReview: "fx.rms.module.incidentReview.enabled",
  cadMessages: "fx.rms.module.cadMessages.enabled",
  cadConnections: "fx.rms.module.cadConnections.enabled",
  cadConflicts: "fx.rms.module.cadConflicts.enabled",
  nerisConfiguration: "fx.rms.module.nerisConfiguration.enabled",
  administration: "fx.rms.module.administration.enabled",
  utilities: "fx.rms.module.utilities.enabled",
} as const;

export type RmsFxModuleFlagKey = (typeof RMS_FX_MODULE_FLAGS)[keyof typeof RMS_FX_MODULE_FLAGS];

export type FxPresentationMode = "fx" | "legacy";

export type IncidentModulePresentation = {
  moduleEnabled: boolean;
  list: FxPresentationMode;
  newForm: FxPresentationMode;
  workspace: FxPresentationMode;
  reasons: {
    list: string;
    newForm: string;
    workspace: string;
  };
};

export type IncidentReviewModulePresentation = {
  moduleEnabled: boolean;
  queue: FxPresentationMode;
  detailForms: FxPresentationMode;
  reasons: {
    queue: string;
    detailForms: string;
  };
};

export type CadMessagesModulePresentation = {
  moduleEnabled: boolean;
  list: FxPresentationMode;
  reasons: {
    list: string;
  };
};

export type CadConnectionsModulePresentation = {
  moduleEnabled: boolean;
  createForm: FxPresentationMode;
  list: FxPresentationMode;
  reasons: {
    createForm: string;
    list: string;
  };
};

export type CadConflictsModulePresentation = {
  moduleEnabled: boolean;
  list: FxPresentationMode;
  reasons: {
    list: string;
  };
};

export type NerisConfigurationModulePresentation = {
  moduleEnabled: boolean;
  forms: FxPresentationMode;
  reasons: {
    forms: string;
  };
};

export type AdministrationModulePresentation = {
  moduleEnabled: boolean;
  selectTenant: FxPresentationMode;
  reasons: {
    selectTenant: string;
  };
};

export type UtilitiesModulePresentation = {
  moduleEnabled: boolean;
  health: FxPresentationMode;
  reasons: {
    health: string;
  };
};

function resolveFlag(input: {
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

export function resolveRmsFxModuleFlag(input: {
  apiEnabled: boolean | undefined;
  isPlatformAdmin: boolean;
  envOverride?: string | undefined;
  sessionOverride?: string | null | undefined;
}): boolean {
  return resolveFlag(input);
}

/**
 * Incident module composition rules (S2F-1):
 * - Module flag off → all legacy (even if foundation flags are on)
 * - Module flag on + foundation off → legacy for that surface (compatibility)
 * - Module flag on + foundation on → FX for that surface
 * Never forces foundation flags on.
 */
export function resolveIncidentModulePresentation(input: {
  moduleEnabled: boolean;
  tablesEnabled: boolean;
  formsEnabled: boolean;
  workspaceEnabled: boolean;
}): IncidentModulePresentation {
  if (!input.moduleEnabled) {
    return {
      moduleEnabled: false,
      list: "legacy",
      newForm: "legacy",
      workspace: "legacy",
      reasons: {
        list: "module-off",
        newForm: "module-off",
        workspace: "module-off",
      },
    };
  }

  return {
    moduleEnabled: true,
    list: input.tablesEnabled ? "fx" : "legacy",
    newForm: input.formsEnabled ? "fx" : "legacy",
    workspace: input.workspaceEnabled ? "fx" : "legacy",
    reasons: {
      list: input.tablesEnabled ? "module+tables" : "module-on-tables-off-compat",
      newForm: input.formsEnabled ? "module+forms" : "module-on-forms-off-compat",
      workspace: input.workspaceEnabled ? "module+workspace" : "module-on-workspace-off-compat",
    },
  };
}

/**
 * Incident Review module composition rules (S2F-2):
 * - Module flag off → legacy queue + legacy review forms
 * - Module on + tables → FX review queue
 * - Module on + forms → FX officer review form chrome (same APIs)
 * Never forces foundation flags on. Independent of incidents module flag.
 */
export function resolveIncidentReviewModulePresentation(input: {
  moduleEnabled: boolean;
  tablesEnabled: boolean;
  formsEnabled: boolean;
}): IncidentReviewModulePresentation {
  if (!input.moduleEnabled) {
    return {
      moduleEnabled: false,
      queue: "legacy",
      detailForms: "legacy",
      reasons: {
        queue: "module-off",
        detailForms: "module-off",
      },
    };
  }

  return {
    moduleEnabled: true,
    queue: input.tablesEnabled ? "fx" : "legacy",
    detailForms: input.formsEnabled ? "fx" : "legacy",
    reasons: {
      queue: input.tablesEnabled ? "module+tables" : "module-on-tables-off-compat",
      detailForms: input.formsEnabled ? "module+forms" : "module-on-forms-off-compat",
    },
  };
}

/**
 * CAD Messages module composition rules (S2F-3):
 * - Module off → legacy list
 * - Module on + tables → FX table
 * - No forms/workspace required for the verified live route
 * Never forces foundation flags on.
 */
export function resolveCadMessagesModulePresentation(input: {
  moduleEnabled: boolean;
  tablesEnabled: boolean;
}): CadMessagesModulePresentation {
  if (!input.moduleEnabled) {
    return {
      moduleEnabled: false,
      list: "legacy",
      reasons: { list: "module-off" },
    };
  }

  return {
    moduleEnabled: true,
    list: input.tablesEnabled ? "fx" : "legacy",
    reasons: {
      list: input.tablesEnabled ? "module+tables" : "module-on-tables-off-compat",
    },
  };
}

/**
 * CAD Connections module composition rules (S2F-4):
 * - Module off → legacy create form + legacy list (even if foundations on)
 * - Module on + forms → FX create form
 * - Module on + tables → FX connections table
 * Never forces foundation flags on. Independent of cadMessages module flag.
 */
export function resolveCadConnectionsModulePresentation(input: {
  moduleEnabled: boolean;
  formsEnabled: boolean;
  tablesEnabled: boolean;
}): CadConnectionsModulePresentation {
  if (!input.moduleEnabled) {
    return {
      moduleEnabled: false,
      createForm: "legacy",
      list: "legacy",
      reasons: {
        createForm: "module-off",
        list: "module-off",
      },
    };
  }

  return {
    moduleEnabled: true,
    createForm: input.formsEnabled ? "fx" : "legacy",
    list: input.tablesEnabled ? "fx" : "legacy",
    reasons: {
      createForm: input.formsEnabled ? "module+forms" : "module-on-forms-off-compat",
      list: input.tablesEnabled ? "module+tables" : "module-on-tables-off-compat",
    },
  };
}

/**
 * CAD Conflicts module composition rules (S2F-5):
 * - Module off → legacy list
 * - Module on + tables → FX table (same resolve actions)
 * - No forms/workspace required for the verified live route
 * Never forces foundation flags on. Independent of other CAD module flags.
 */
export function resolveCadConflictsModulePresentation(input: {
  moduleEnabled: boolean;
  tablesEnabled: boolean;
}): CadConflictsModulePresentation {
  if (!input.moduleEnabled) {
    return {
      moduleEnabled: false,
      list: "legacy",
      reasons: { list: "module-off" },
    };
  }

  return {
    moduleEnabled: true,
    list: input.tablesEnabled ? "fx" : "legacy",
    reasons: {
      list: input.tablesEnabled ? "module+tables" : "module-on-tables-off-compat",
    },
  };
}

/**
 * NERIS Configuration module composition rules (S2F-6):
 * - Module off → legacy forms
 * - Module on + forms → FX forms (same save payloads)
 * - Shell/nav ambient only; never required or forced by this module
 * Never forces foundation flags on.
 */
export function resolveNerisConfigurationModulePresentation(input: {
  moduleEnabled: boolean;
  formsEnabled: boolean;
}): NerisConfigurationModulePresentation {
  if (!input.moduleEnabled) {
    return {
      moduleEnabled: false,
      forms: "legacy",
      reasons: { forms: "module-off" },
    };
  }

  return {
    moduleEnabled: true,
    forms: input.formsEnabled ? "fx" : "legacy",
    reasons: {
      forms: input.formsEnabled ? "module+forms" : "module-on-forms-off-compat",
    },
  };
}

/**
 * Administration module composition rules (S2F-7):
 * - Module off → legacy select-tenant table
 * - Module on + tables → FX select-tenant table
 * - Login / auth callback intentionally not migrated (auth out of scope)
 * Never forces foundation flags on.
 */
export function resolveAdministrationModulePresentation(input: {
  moduleEnabled: boolean;
  tablesEnabled: boolean;
}): AdministrationModulePresentation {
  if (!input.moduleEnabled) {
    return {
      moduleEnabled: false,
      selectTenant: "legacy",
      reasons: { selectTenant: "module-off" },
    };
  }

  return {
    moduleEnabled: true,
    selectTenant: input.tablesEnabled ? "fx" : "legacy",
    reasons: {
      selectTenant: input.tablesEnabled ? "module+tables" : "module-on-tables-off-compat",
    },
  };
}

/**
 * Utilities module composition rules (S2F-7):
 * - Module off → legacy health page
 * - Module on → FX health presentation (no forms/tables required for verified surface)
 * Never forces foundation flags on. Independent of administration module flag.
 */
export function resolveUtilitiesModulePresentation(input: {
  moduleEnabled: boolean;
}): UtilitiesModulePresentation {
  if (!input.moduleEnabled) {
    return {
      moduleEnabled: false,
      health: "legacy",
      reasons: { health: "module-off" },
    };
  }

  return {
    moduleEnabled: true,
    health: "fx",
    reasons: { health: "module-on" },
  };
}
