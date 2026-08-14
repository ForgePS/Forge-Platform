/**
 * Forge Industrial Safety product contracts.
 * Module registry drives Industrial shell navigation and bootstrap flags.
 */

export const INDUSTRIAL_PRODUCT_CODE = "FORGE_INDUSTRIAL" as const;

/** Ops + shell permissions used by industrial-web and Nest Industrial APIs. */
export const INDUSTRIAL_PERMISSIONS = [
  "industrial.access",
  "industrial.admin",
  "industrial.personnel.view",
  "industrial.personnel.manage",
  "industrial.training.view",
  "industrial.training.manage",
  "industrial.forms.view",
  "industrial.forms.manage",
  "industrial.inspections.view",
  "industrial.inspections.manage",
  "industrial.incidents.view",
  "industrial.incidents.manage",
  "industrial.jsa.view",
  "industrial.jsa.manage",
  "industrial.observations.view",
  "industrial.observations.manage",
] as const;

export type IndustrialPermission = (typeof INDUSTRIAL_PERMISSIONS)[number];

export type IndustrialMigrationStatus =
  | "FOUNDATION_ONLY"
  | "MIGRATION_IN_PROGRESS"
  | "LEGACY_FIREBASE"
  | "DISABLED"
  | "LIVE";

export type IndustrialModuleRegistryEntry = {
  code: string;
  name: string;
  group: string;
  route: string;
  migrationStatus: IndustrialMigrationStatus;
};

function slugRoute(code: string): string {
  return `/modules/${code.toLowerCase().replace(/_/g, "-")}`;
}

/**
 * Navigation source of truth for industrial-web.
 * Group names follow Industrial UX Parity business IA (Sneat shell).
 * CORE is foundation-only (Dashboard).
 * Modules with AWS workspaces are MIGRATION_IN_PROGRESS (flag-gated).
 * Scan remains LEGACY_FIREBASE until a dedicated workspace ships.
 * Fleet is OUT_OF_SCOPE for UX-PARITY-S1 (dedicated Fleet sprint).
 */
export const INDUSTRIAL_MODULE_REGISTRY: readonly IndustrialModuleRegistryEntry[] = [
  {
    code: "CORE",
    name: "Dashboard",
    group: "Overview",
    route: "/",
    migrationStatus: "FOUNDATION_ONLY",
  },
  {
    code: "ANALYTICS",
    name: "Analytics",
    group: "Reporting",
    route: slugRoute("ANALYTICS"),
    migrationStatus: "MIGRATION_IN_PROGRESS",
  },
  {
    code: "PERSONNEL",
    name: "Personnel",
    group: "People",
    route: slugRoute("PERSONNEL"),
    migrationStatus: "MIGRATION_IN_PROGRESS",
  },
  {
    code: "TRAINING",
    name: "Training",
    group: "People",
    route: slugRoute("TRAINING"),
    migrationStatus: "MIGRATION_IN_PROGRESS",
  },
  {
    code: "JSAS",
    name: "JSAs",
    group: "People",
    route: slugRoute("JSAS"),
    migrationStatus: "MIGRATION_IN_PROGRESS",
  },
  {
    code: "INCIDENTS",
    name: "Incidents",
    group: "Safety",
    route: slugRoute("INCIDENTS"),
    migrationStatus: "MIGRATION_IN_PROGRESS",
  },
  {
    code: "OSHA",
    name: "OSHA Recordkeeping",
    group: "Safety",
    route: slugRoute("OSHA"),
    migrationStatus: "MIGRATION_IN_PROGRESS",
  },
  {
    code: "WORKERS_COMP",
    name: "Workers' Compensation",
    group: "Safety",
    route: slugRoute("WORKERS_COMP"),
    migrationStatus: "MIGRATION_IN_PROGRESS",
  },
  {
    code: "INSPECTIONS",
    name: "Inspections",
    group: "Safety",
    route: slugRoute("INSPECTIONS"),
    migrationStatus: "MIGRATION_IN_PROGRESS",
  },
  {
    code: "FORMS",
    name: "Forms",
    group: "Safety",
    route: slugRoute("FORMS"),
    migrationStatus: "MIGRATION_IN_PROGRESS",
  },
  {
    code: "OBSERVATIONS",
    name: "Observations",
    group: "Safety",
    route: slugRoute("OBSERVATIONS"),
    migrationStatus: "MIGRATION_IN_PROGRESS",
  },
  {
    code: "RISK",
    name: "Risk Register",
    group: "Safety",
    route: slugRoute("RISK"),
    migrationStatus: "MIGRATION_IN_PROGRESS",
  },
  {
    code: "SCAN",
    name: "Scan",
    group: "Safety",
    route: slugRoute("SCAN"),
    migrationStatus: "LEGACY_FIREBASE",
  },
  {
    code: "DOT_COMPLIANCE",
    name: "DOT Compliance",
    group: "Compliance",
    route: slugRoute("DOT_COMPLIANCE"),
    migrationStatus: "MIGRATION_IN_PROGRESS",
  },
  {
    code: "CONTRACTOR_SAFETY",
    name: "Contractor Safety",
    group: "Compliance",
    route: slugRoute("CONTRACTOR_SAFETY"),
    migrationStatus: "MIGRATION_IN_PROGRESS",
  },
  {
    code: "PROCESS_SAFETY",
    name: "Process Safety",
    group: "Compliance",
    route: slugRoute("PROCESS_SAFETY"),
    migrationStatus: "MIGRATION_IN_PROGRESS",
  },
  {
    code: "ENVIRONMENTAL_SAFETY",
    name: "Environmental Safety",
    group: "Compliance",
    route: slugRoute("ENVIRONMENTAL_SAFETY"),
    migrationStatus: "MIGRATION_IN_PROGRESS",
  },
  {
    code: "EQUIPMENT",
    name: "Assets & Equipment",
    group: "Operations",
    route: slugRoute("EQUIPMENT"),
    migrationStatus: "MIGRATION_IN_PROGRESS",
  },
  {
    code: "FORKLIFTS",
    name: "Forklifts",
    group: "Operations",
    route: slugRoute("FORKLIFTS"),
    migrationStatus: "MIGRATION_IN_PROGRESS",
  },
  {
    code: "CRANES_RIGGING",
    name: "Cranes & Rigging",
    group: "Operations",
    route: slugRoute("CRANES_RIGGING"),
    migrationStatus: "MIGRATION_IN_PROGRESS",
  },
  {
    code: "MACHINE_SAFETY",
    name: "Machine Safety",
    group: "Operations",
    route: slugRoute("MACHINE_SAFETY"),
    migrationStatus: "MIGRATION_IN_PROGRESS",
  },
  {
    code: "ELECTRICAL_SAFETY",
    name: "Electrical Safety",
    group: "Operations",
    route: slugRoute("ELECTRICAL_SAFETY"),
    migrationStatus: "MIGRATION_IN_PROGRESS",
  },
  {
    code: "LOCKOUT_TAGOUT",
    name: "Lockout/Tagout",
    group: "Safety Programs",
    route: slugRoute("LOCKOUT_TAGOUT"),
    migrationStatus: "MIGRATION_IN_PROGRESS",
  },
  {
    code: "CONFINED_SPACE",
    name: "Confined Space",
    group: "Safety Programs",
    route: slugRoute("CONFINED_SPACE"),
    migrationStatus: "MIGRATION_IN_PROGRESS",
  },
  {
    code: "HOT_WORK",
    name: "Hot Work",
    group: "Safety Programs",
    route: slugRoute("HOT_WORK"),
    migrationStatus: "MIGRATION_IN_PROGRESS",
  },
  {
    code: "WORKING_AT_HEIGHTS",
    name: "Working at Heights",
    group: "Safety Programs",
    route: slugRoute("WORKING_AT_HEIGHTS"),
    migrationStatus: "MIGRATION_IN_PROGRESS",
  },
  {
    code: "CHEMICAL_SAFETY",
    name: "Chemical Safety",
    group: "Safety Programs",
    route: slugRoute("CHEMICAL_SAFETY"),
    migrationStatus: "MIGRATION_IN_PROGRESS",
  },
  {
    code: "WAREHOUSE_SAFETY",
    name: "Warehouse Safety",
    group: "Safety Programs",
    route: slugRoute("WAREHOUSE_SAFETY"),
    migrationStatus: "MIGRATION_IN_PROGRESS",
  },
  {
    code: "MANUFACTURING_SAFETY",
    name: "Manufacturing Safety",
    group: "Safety Programs",
    route: slugRoute("MANUFACTURING_SAFETY"),
    migrationStatus: "MIGRATION_IN_PROGRESS",
  },
  {
    code: "EMERGENCY_RESPONSE",
    name: "Emergency Response",
    group: "Safety Programs",
    route: slugRoute("EMERGENCY_RESPONSE"),
    migrationStatus: "MIGRATION_IN_PROGRESS",
  },
  {
    code: "TASKS",
    name: "Tasks",
    group: "Administration",
    route: slugRoute("TASKS"),
    migrationStatus: "MIGRATION_IN_PROGRESS",
  },
  {
    code: "MESSAGING",
    name: "Messaging",
    group: "Communication",
    route: slugRoute("MESSAGING"),
    migrationStatus: "MIGRATION_IN_PROGRESS",
  },
  {
    code: "DOCUMENTS",
    name: "Document Control",
    group: "Operations",
    route: slugRoute("DOCUMENTS"),
    migrationStatus: "MIGRATION_IN_PROGRESS",
  },
  {
    code: "QR_LINKS",
    name: "QR Links",
    group: "Operations",
    route: slugRoute("QR_LINKS"),
    migrationStatus: "MIGRATION_IN_PROGRESS",
  },
  {
    code: "REPORTING",
    name: "Reporting",
    group: "Reporting",
    route: slugRoute("REPORTING"),
    migrationStatus: "MIGRATION_IN_PROGRESS",
  },
  {
    code: "IMPORT",
    name: "Import Center",
    group: "Administration",
    route: slugRoute("IMPORT"),
    migrationStatus: "MIGRATION_IN_PROGRESS",
  },
] as const;

/** Feature-flag keys used by industrial-web navigation + Nest bootstrap. */
export const INDUSTRIAL_FEATURE_FLAGS = [
  "industrial.enabled",
  "industrial.module.analytics.enabled",
  "industrial.module.personnel.enabled",
  "industrial.module.incidents.enabled",
  "industrial.module.inspections.enabled",
  "industrial.module.training.enabled",
  "industrial.module.jsa.enabled",
  "industrial.module.observations.enabled",
  "industrial.module.forms.enabled",
  "industrial.module.scan.enabled",
  "industrial.module.qr_links.enabled",
  "industrial.module.documents.enabled",
  "industrial.module.reporting.enabled",
  "industrial.module.loto.enabled",
  "industrial.module.equipment.enabled",
  "industrial.module.forklifts.enabled",
  "industrial.module.confined_space.enabled",
  "industrial.module.hot_work.enabled",
  "industrial.module.working_at_heights.enabled",
  "industrial.module.electrical_safety.enabled",
  "industrial.module.cranes_rigging.enabled",
  "industrial.module.machine_safety.enabled",
  "industrial.module.dot.enabled",
  "industrial.module.workers_comp.enabled",
  "industrial.module.osha.enabled",
  "industrial.module.risk.enabled",
  "industrial.module.chemical_safety.enabled",
  "industrial.module.warehouse_safety.enabled",
  "industrial.module.manufacturing_safety.enabled",
  "industrial.module.contractor_safety.enabled",
  "industrial.module.process_safety.enabled",
  "industrial.module.environmental_safety.enabled",
  "industrial.module.tasks.enabled",
  "industrial.module.messaging.enabled",
  "industrial.module.emergency_response.enabled",
] as const;
