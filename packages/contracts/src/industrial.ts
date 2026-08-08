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
 * Group names mirror the Firebase Bridge / Producers Rice Mill sidebar.
 * CORE is foundation-only; IND-3 ops modules are MIGRATION_IN_PROGRESS until flagged LIVE later.
 */
export const INDUSTRIAL_MODULE_REGISTRY: readonly IndustrialModuleRegistryEntry[] = [
  {
    code: "CORE",
    name: "Industrial Core",
    group: "Dashboard",
    route: "/",
    migrationStatus: "FOUNDATION_ONLY",
  },
  {
    code: "ANALYTICS",
    name: "Analytics",
    group: "Dashboard",
    route: slugRoute("ANALYTICS"),
    migrationStatus: "LEGACY_FIREBASE",
  },
  {
    code: "PERSONNEL",
    name: "Personnel",
    group: "People & Training",
    route: slugRoute("PERSONNEL"),
    migrationStatus: "MIGRATION_IN_PROGRESS",
  },
  {
    code: "TRAINING",
    name: "Training",
    group: "People & Training",
    route: slugRoute("TRAINING"),
    migrationStatus: "MIGRATION_IN_PROGRESS",
  },
  {
    code: "JSAS",
    name: "JSAs",
    group: "People & Training",
    route: slugRoute("JSAS"),
    migrationStatus: "MIGRATION_IN_PROGRESS",
  },
  {
    code: "INCIDENTS",
    name: "Incidents",
    group: "Incident & Claims",
    route: slugRoute("INCIDENTS"),
    migrationStatus: "MIGRATION_IN_PROGRESS",
  },
  {
    code: "OSHA",
    name: "OSHA Recordkeeping",
    group: "Incident & Claims",
    route: slugRoute("OSHA"),
    migrationStatus: "LEGACY_FIREBASE",
  },
  {
    code: "WORKERS_COMP",
    name: "Workers' Compensation",
    group: "Incident & Claims",
    route: slugRoute("WORKERS_COMP"),
    migrationStatus: "LEGACY_FIREBASE",
  },
  {
    code: "INSPECTIONS",
    name: "Inspections",
    group: "Risk & Prevention",
    route: slugRoute("INSPECTIONS"),
    migrationStatus: "MIGRATION_IN_PROGRESS",
  },
  {
    code: "FORMS",
    name: "Forms",
    group: "Risk & Prevention",
    route: slugRoute("FORMS"),
    migrationStatus: "MIGRATION_IN_PROGRESS",
  },
  {
    code: "OBSERVATIONS",
    name: "Observations",
    group: "Risk & Prevention",
    route: slugRoute("OBSERVATIONS"),
    migrationStatus: "MIGRATION_IN_PROGRESS",
  },
  {
    code: "RISK",
    name: "Risk Register",
    group: "Risk & Prevention",
    route: slugRoute("RISK"),
    migrationStatus: "LEGACY_FIREBASE",
  },
  {
    code: "SCAN",
    name: "Scan",
    group: "Risk & Prevention",
    route: slugRoute("SCAN"),
    migrationStatus: "LEGACY_FIREBASE",
  },
  {
    code: "DOT_COMPLIANCE",
    name: "DOT Compliance",
    group: "Compliance Programs",
    route: slugRoute("DOT_COMPLIANCE"),
    migrationStatus: "LEGACY_FIREBASE",
  },
  {
    code: "CONTRACTOR_SAFETY",
    name: "Contractor Safety",
    group: "Compliance Programs",
    route: slugRoute("CONTRACTOR_SAFETY"),
    migrationStatus: "LEGACY_FIREBASE",
  },
  {
    code: "PROCESS_SAFETY",
    name: "Process Safety",
    group: "Compliance Programs",
    route: slugRoute("PROCESS_SAFETY"),
    migrationStatus: "LEGACY_FIREBASE",
  },
  {
    code: "ENVIRONMENTAL_SAFETY",
    name: "Environmental Safety",
    group: "Compliance Programs",
    route: slugRoute("ENVIRONMENTAL_SAFETY"),
    migrationStatus: "LEGACY_FIREBASE",
  },
  {
    code: "EQUIPMENT",
    name: "Assets & Equipment",
    group: "Equipment & Operations",
    route: slugRoute("EQUIPMENT"),
    migrationStatus: "LEGACY_FIREBASE",
  },
  {
    code: "FORKLIFTS",
    name: "Forklifts",
    group: "Equipment & Operations",
    route: slugRoute("FORKLIFTS"),
    migrationStatus: "LEGACY_FIREBASE",
  },
  {
    code: "CRANES_RIGGING",
    name: "Cranes & Rigging",
    group: "Equipment & Operations",
    route: slugRoute("CRANES_RIGGING"),
    migrationStatus: "LEGACY_FIREBASE",
  },
  {
    code: "MACHINE_SAFETY",
    name: "Machine Safety",
    group: "Equipment & Operations",
    route: slugRoute("MACHINE_SAFETY"),
    migrationStatus: "LEGACY_FIREBASE",
  },
  {
    code: "ELECTRICAL_SAFETY",
    name: "Electrical Safety",
    group: "Equipment & Operations",
    route: slugRoute("ELECTRICAL_SAFETY"),
    migrationStatus: "LEGACY_FIREBASE",
  },
  {
    code: "LOCKOUT_TAGOUT",
    name: "Lockout/Tagout",
    group: "High-Risk Work",
    route: slugRoute("LOCKOUT_TAGOUT"),
    migrationStatus: "LEGACY_FIREBASE",
  },
  {
    code: "CONFINED_SPACE",
    name: "Confined Space",
    group: "High-Risk Work",
    route: slugRoute("CONFINED_SPACE"),
    migrationStatus: "LEGACY_FIREBASE",
  },
  {
    code: "HOT_WORK",
    name: "Hot Work",
    group: "High-Risk Work",
    route: slugRoute("HOT_WORK"),
    migrationStatus: "LEGACY_FIREBASE",
  },
  {
    code: "WORKING_AT_HEIGHTS",
    name: "Working at Heights",
    group: "High-Risk Work",
    route: slugRoute("WORKING_AT_HEIGHTS"),
    migrationStatus: "LEGACY_FIREBASE",
  },
  {
    code: "CHEMICAL_SAFETY",
    name: "Chemical Safety",
    group: "Facility & Operations Safety",
    route: slugRoute("CHEMICAL_SAFETY"),
    migrationStatus: "LEGACY_FIREBASE",
  },
  {
    code: "WAREHOUSE_SAFETY",
    name: "Warehouse Safety",
    group: "Facility & Operations Safety",
    route: slugRoute("WAREHOUSE_SAFETY"),
    migrationStatus: "LEGACY_FIREBASE",
  },
  {
    code: "MANUFACTURING_SAFETY",
    name: "Manufacturing Safety",
    group: "Facility & Operations Safety",
    route: slugRoute("MANUFACTURING_SAFETY"),
    migrationStatus: "LEGACY_FIREBASE",
  },
  {
    code: "EMERGENCY_RESPONSE",
    name: "Emergency Response",
    group: "Emergency Management",
    route: slugRoute("EMERGENCY_RESPONSE"),
    migrationStatus: "LEGACY_FIREBASE",
  },
  {
    code: "TASKS",
    name: "Tasks",
    group: "System Tools",
    route: slugRoute("TASKS"),
    migrationStatus: "LEGACY_FIREBASE",
  },
  {
    code: "MESSAGING",
    name: "Messaging",
    group: "System Tools",
    route: slugRoute("MESSAGING"),
    migrationStatus: "LEGACY_FIREBASE",
  },
  {
    code: "DOCUMENTS",
    name: "Document Control",
    group: "System Tools",
    route: slugRoute("DOCUMENTS"),
    migrationStatus: "LEGACY_FIREBASE",
  },
  {
    code: "QR_LINKS",
    name: "QR Links",
    group: "System Tools",
    route: slugRoute("QR_LINKS"),
    migrationStatus: "LEGACY_FIREBASE",
  },
  {
    code: "REPORTING",
    name: "Reporting",
    group: "System Tools",
    route: slugRoute("REPORTING"),
    migrationStatus: "LEGACY_FIREBASE",
  },
  {
    code: "IMPORT",
    name: "Import Center",
    group: "System Tools",
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
