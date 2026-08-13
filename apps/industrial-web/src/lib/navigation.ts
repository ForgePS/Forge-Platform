import { INDUSTRIAL_MODULE_REGISTRY } from "@forge/contracts";

export type IndustrialNavItem = {
  code: string;
  name: string;
  group: string;
  route: string;
  migrationStatus: string;
  awsEnabled: boolean;
  available: boolean;
  requiredPermissions: string[];
};

const FLAG_BY_CODE: Record<string, string> = {
  CORE: "industrial.enabled",
  ANALYTICS: "industrial.module.analytics.enabled",
  PERSONNEL: "industrial.module.personnel.enabled",
  INCIDENTS: "industrial.module.incidents.enabled",
  INSPECTIONS: "industrial.module.inspections.enabled",
  TRAINING: "industrial.module.training.enabled",
  JSAS: "industrial.module.jsa.enabled",
  OBSERVATIONS: "industrial.module.observations.enabled",
  FORMS: "industrial.module.forms.enabled",
  SCAN: "industrial.module.scan.enabled",
  QR_LINKS: "industrial.module.qr_links.enabled",
  DOCUMENTS: "industrial.module.documents.enabled",
  REPORTING: "industrial.module.reporting.enabled",
  IMPORT: "industrial.enabled",
  LOCKOUT_TAGOUT: "industrial.module.loto.enabled",
  EQUIPMENT: "industrial.module.equipment.enabled",
  FORKLIFTS: "industrial.module.forklifts.enabled",
  CONFINED_SPACE: "industrial.module.confined_space.enabled",
  HOT_WORK: "industrial.module.hot_work.enabled",
  WORKING_AT_HEIGHTS: "industrial.module.working_at_heights.enabled",
  ELECTRICAL_SAFETY: "industrial.module.electrical_safety.enabled",
  CRANES_RIGGING: "industrial.module.cranes_rigging.enabled",
  MACHINE_SAFETY: "industrial.module.machine_safety.enabled",
  DOT_COMPLIANCE: "industrial.module.dot.enabled",
  WORKERS_COMP: "industrial.module.workers_comp.enabled",
  OSHA: "industrial.module.osha.enabled",
  RISK: "industrial.module.risk.enabled",
  CHEMICAL_SAFETY: "industrial.module.chemical_safety.enabled",
  WAREHOUSE_SAFETY: "industrial.module.warehouse_safety.enabled",
  MANUFACTURING_SAFETY: "industrial.module.manufacturing_safety.enabled",
  CONTRACTOR_SAFETY: "industrial.module.contractor_safety.enabled",
  PROCESS_SAFETY: "industrial.module.process_safety.enabled",
  ENVIRONMENTAL_SAFETY: "industrial.module.environmental_safety.enabled",
  TASKS: "industrial.module.tasks.enabled",
  MESSAGING: "industrial.module.messaging.enabled",
  EMERGENCY_RESPONSE: "industrial.module.emergency_response.enabled",
};

export function featureFlagForModule(code: string): string {
  return FLAG_BY_CODE[code] ?? `industrial.module.${code.toLowerCase()}.enabled`;
}

export function buildIndustrialNavigation(input: {
  entitled: boolean;
  permissions: ReadonlySet<string> | string[];
  flags: Record<string, boolean>;
}): IndustrialNavItem[] {
  if (!input.entitled) {
    return [];
  }
  const perms = input.permissions instanceof Set ? input.permissions : new Set(input.permissions);
  if (!perms.has("industrial.access")) {
    return [];
  }

  return INDUSTRIAL_MODULE_REGISTRY.map((entry) => {
    const flagKey = featureFlagForModule(entry.code);
    const awsEnabled =
      entry.code === "CORE"
        ? Boolean(input.flags["industrial.enabled"])
        : Boolean(input.flags[flagKey]);

    const requiredPermissions =
      entry.code === "CORE" ? ["industrial.access"] : ["industrial.access"];

    const hasPerms = requiredPermissions.every((p) => perms.has(p));
    const migrationStatus: string = entry.migrationStatus;
    const available =
      hasPerms &&
      (migrationStatus === "FOUNDATION_ONLY" ||
        (awsEnabled && migrationStatus !== "LEGACY_FIREBASE" && migrationStatus !== "DISABLED"));

    return {
      code: entry.code,
      name: entry.name,
      group: entry.group,
      route: entry.route,
      migrationStatus,
      awsEnabled,
      available,
      requiredPermissions,
    };
  });
}

export function moduleUnavailableMessage(moduleName: string, status?: string): string {
  if (status === "LEGACY_FIREBASE") {
    return `${moduleName} is coming soon.`;
  }
  if (status === "DISABLED") {
    return `${moduleName} is disabled for your organization.`;
  }
  if (status === "MIGRATION_IN_PROGRESS") {
    return `${moduleName} is disabled for your organization. Ask a platform admin if you need access.`;
  }
  return `${moduleName} is not available yet.`;
}

/** Friendly admin-facing summary — never exposes raw migration enums. */
export function moduleUnavailableSummary(status?: string): string {
  if (status === "LEGACY_FIREBASE") {
    return "This module has not shipped on the current platform yet.";
  }
  if (status === "DISABLED") {
    return "This module is turned off for the current organization.";
  }
  if (status === "MIGRATION_IN_PROGRESS") {
    return "This module exists but is not enabled for the current organization.";
  }
  return "This module is not available in the current environment.";
}

export function navLabelForItem(
  item: Pick<IndustrialNavItem, "name" | "migrationStatus" | "available" | "awsEnabled">,
): string {
  if (item.migrationStatus === "LEGACY_FIREBASE") {
    return `${item.name} (coming soon)`;
  }
  if (item.migrationStatus === "DISABLED") {
    return `${item.name} (disabled)`;
  }
  if (
    (item.migrationStatus === "MIGRATION_IN_PROGRESS" || item.migrationStatus === "LIVE") &&
    !item.available
  ) {
    return item.awsEnabled ? item.name : `${item.name} (not available yet)`;
  }
  return item.name;
}
