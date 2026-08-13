/**
 * Final DM-S2 source → target matrix for all 80 Firebase root collections.
 * UNKNOWN is not permitted.
 */

import type { SourceTargetMapping } from "./types.js";

function m(
  sourceCollection: string,
  disposition: SourceTargetMapping["disposition"],
  targetService: string,
  targetEntity: string,
  implementationStatus: SourceTargetMapping["implementationStatus"],
  notes: string,
  facilityKeyField: string | null = "siteId",
  tenantKeyField = "businessId|organizationId",
): SourceTargetMapping {
  return {
    sourceCollection,
    disposition,
    targetService,
    targetEntity,
    tenantKeyField,
    facilityKeyField,
    implementationStatus,
    notes,
  };
}

/** Authoritative matrix — every DM-S0 root collection must appear exactly once. */
export const SOURCE_TARGET_MATRIX: SourceTargetMapping[] = [
  m("activityLogs", "ARCHIVE", "archive", "archive/activity_logs", "ARCHIVE_ONLY", "High volume audit; retain in package only", null),
  m("assetRecords", "TRANSFORM", "aurora", "industrial_equipment", "READY", "Live IND-11 table"),
  m("auth_audit_logs", "ARCHIVE", "archive", "archive/auth_audit_logs", "ARCHIVE_ONLY", "Contains LEGACY_ALIAS tenant keys; quarantine/archive", null),
  m("certificate_image_library", "TRANSFORM", "s3+aurora", "attachments/certificate_images", "PARTIAL", "Blob→S3; metadata attachment row"),
  m("certificate_templates", "TRANSFORM", "aurora", "industrial_certificate_templates", "PARTIAL", "Templates; confirm tip DDL"),
  m("chemicalSafetyRecords", "TRANSFORM", "aurora", "industrial_chemical_safety_records", "READY", "Live IND-11"),
  m("companyVehicleDriverSettings", "ARCHIVE", "archive", "archive/company_vehicle_driver_settings", "MISSING", "TARGET_SCHEMA_GAP + drift", null),
  m("companyVehicleDrivers", "ARCHIVE", "archive", "archive/company_vehicle_drivers", "MISSING", "TARGET_SCHEMA_GAP + SIGNIFICANT_DRIFT", null),
  m("confinedSpaceRecords", "TRANSFORM", "aurora", "industrial_confined_space_records", "READY", "Live IND-11"),
  m("content_overrides", "EXCLUDE_WITH_APPROVAL", "none", "excluded/content_overrides", "ARCHIVE_ONLY", "DELTA_UNSAFE unscoped", null),
  m("contractorSafetyRecords", "TRANSFORM", "aurora", "industrial_contractor_safety_records", "PARTIAL", "Workbook family; table name AMBIGUOUS on tip"),
  m("controlledDocuments", "TRANSFORM", "aurora+s3", "platform_documents", "READY", "Live IND-11; tip DDL still missing"),
  m("conversations", "EXCLUDE_WITH_APPROVAL", "none", "excluded/conversations", "ARCHIVE_ONLY", "Messaging not industrial SoT", null),
  m("correctiveActionRecords", "ARCHIVE", "archive", "archive/corrective_action_records", "MISSING", "TARGET_SCHEMA_GAP", null),
  m("cranesRiggingRecords", "TRANSFORM", "aurora", "industrial_cranes_rigging_records", "PARTIAL", "Workbook family"),
  m("departments", "TRANSFORM", "aurora", "industrial_departments", "PARTIAL", "Areas/org units; exact tip table AMBIGUOUS"),
  m("documentAccessEvents", "ARCHIVE", "archive", "archive/document_access_events", "ARCHIVE_ONLY", "Orphan FK risk", null),
  m("dotComplianceRecords", "TRANSFORM", "aurora", "industrial_dot_compliance_records", "PARTIAL", "Storage-heavy; table AMBIGUOUS"),
  m("ehsAuditTemplateVersions", "GLOBAL", "platform", "platform_ehs_audit_template_versions", "READY", "GLOBAL_TEMPLATE — do not copy into customer tenant", null, "GLOBAL"),
  m("ehsAuditTemplates", "GLOBAL", "platform", "platform_ehs_audit_templates", "READY", "GLOBAL_TEMPLATE", null, "GLOBAL"),
  m("electricalSafetyRecords", "TRANSFORM", "aurora", "industrial_electrical_safety_records", "PARTIAL", "Workbook family"),
  m("emergencyResponseRecords", "TRANSFORM", "aurora", "industrial_emergency_response_records", "READY", "Live IND-11"),
  m("environmentalSafetyRecords", "TRANSFORM", "aurora", "industrial_environmental_safety_records", "PARTIAL", "Workbook family"),
  m("equipmentDocuments", "TRANSFORM", "aurora+s3", "industrial_equipment_document_links", "READY", "Live IND-11"),
  m("equipmentMigrationBatches", "ARCHIVE", "archive", "archive/equipment_migration_batches", "ARCHIVE_ONLY", "Tooling residue", null),
  m("forkliftRecords", "TRANSFORM", "aurora", "industrial_forklift_records", "PARTIAL", "Workbook family"),
  m("formSubmissions", "TRANSFORM", "aurora", "industrial_form_submissions", "READY", "Live IND-11"),
  m("formTemplates", "TRANSFORM", "aurora", "industrial_form_definitions", "READY", "Live IND-11"),
  m("hotWorkRecords", "TRANSFORM", "aurora", "industrial_hot_work_records", "READY", "Live IND-11"),
  m("incidents", "TRANSFORM", "aurora", "industrial_incidents", "READY", "Live IND-11"),
  m("inspectionRecords", "TRANSFORM", "aurora", "industrial_inspections", "READY", "Live IND-11"),
  m("inspectionTemplates", "MERGE", "aurora", "industrial_inspections", "PARTIAL", "Templates may merge with inspection defs"),
  m("lotoLibraries", "ARCHIVE", "archive", "archive/loto_libraries", "MISSING", "TARGET_SCHEMA_GAP", null),
  m("lotoProcedures", "TRANSFORM", "aurora", "industrial_loto_procedures", "READY", "Live IND-11"),
  m("lotoRecords", "ARCHIVE", "archive", "archive/loto_records", "MISSING", "TARGET_SCHEMA_GAP", null),
  m("machineSafetyRecords", "TRANSFORM", "aurora", "industrial_machine_safety_records", "PARTIAL", "Workbook family"),
  m("manufacturingSafetyRecords", "TRANSFORM", "aurora", "industrial_manufacturing_safety_records", "PARTIAL", "Workbook family"),
  m("messages", "EXCLUDE_WITH_APPROVAL", "none", "excluded/messages", "ARCHIVE_ONLY", "Messaging not industrial SoT", null),
  m("organization_users", "SPLIT", "aurora", "users+memberships", "READY", "Tip platform users/memberships", null),
  m("organizations", "TRANSFORM", "aurora", "tenants", "READY", "Map businessId → AWS tenant UUID", null),
  m("oshaCases", "TRANSFORM", "aurora", "industrial_osha_cases", "PARTIAL", "Related to WC/incident family"),
  m("personnelRecords", "TRANSFORM", "aurora", "industrial_personnel", "READY", "Live IND-11"),
  m("personnelRosterImportSettings", "EXCLUDE_WITH_APPROVAL", "none", "excluded/personnel_roster_import_settings", "ARCHIVE_ONLY", "Import tooling settings", null),
  m("platformAiAssistantLogs", "EXCLUDE_WITH_APPROVAL", "none", "excluded/platform_ai_assistant_logs", "ARCHIVE_ONLY", "Platform ops logs", null),
  m("platformBillingEmailTemplates", "EXCLUDE_WITH_APPROVAL", "none", "excluded/platform_billing_email_templates", "ARCHIVE_ONLY", "SaaS billing", null),
  m("platformBillingNotifications", "EXCLUDE_WITH_APPROVAL", "none", "excluded/platform_billing_notifications", "ARCHIVE_ONLY", "SaaS billing", null),
  m("platformBillingOutbox", "EXCLUDE_WITH_APPROVAL", "none", "excluded/platform_billing_outbox", "ARCHIVE_ONLY", "SaaS billing", null),
  m("platformBusinesses", "MERGE", "aurora", "tenants", "READY", "Mirrors organizations", null),
  m("platformFeedback", "EXCLUDE_WITH_APPROVAL", "none", "excluded/platform_feedback", "ARCHIVE_ONLY", "Platform feedback", null),
  m("platformInvoiceTemplates", "EXCLUDE_WITH_APPROVAL", "none", "excluded/platform_invoice_templates", "ARCHIVE_ONLY", "SaaS billing", null),
  m("platformInvoices", "EXCLUDE_WITH_APPROVAL", "none", "excluded/platform_invoices", "ARCHIVE_ONLY", "SaaS billing", null),
  m("platformNotificationOutbox", "EXCLUDE_WITH_APPROVAL", "none", "excluded/platform_notification_outbox", "ARCHIVE_ONLY", "Platform notifications", null),
  m("platformSettings", "GLOBAL", "platform", "platform_settings", "READY", "Platform config — not customer tenant", null, "platform"),
  m("platformUsers", "TRANSFORM", "aurora", "users", "READY", "Tip users", null),
  m("processSafetyRecords", "TRANSFORM", "aurora", "industrial_process_safety_records", "PARTIAL", "Workbook family"),
  m("qr_link_audit_events", "ARCHIVE", "archive", "archive/qr_link_audit_events", "ARCHIVE_ONLY", "Retention window policy", null),
  m("qr_link_scan_events", "ARCHIVE", "archive", "archive/qr_link_scan_events", "MISSING", "TARGET_SCHEMA_GAP scan events", null),
  m("qr_link_versions", "TRANSFORM", "aurora", "qr_link_versions", "PARTIAL", "Loaded live; tip SQL name AMBIGUOUS"),
  m("qr_links", "TRANSFORM", "aurora", "qr_links", "READY", "Live IND-11; not tip drizzle"),
  m("scan_assignments", "ARCHIVE", "archive", "archive/scan_assignments", "MISSING", "TARGET_SCHEMA_GAP", null),
  m("scan_audit_logs", "ARCHIVE", "archive", "archive/scan_audit_logs", "MISSING", "TARGET_SCHEMA_GAP", null),
  m("scan_check_schedules", "ARCHIVE", "archive", "archive/scan_check_schedules", "MISSING", "TARGET_SCHEMA_GAP", null),
  m("scan_qr_codes", "ARCHIVE", "archive", "archive/scan_qr_codes", "MISSING", "TARGET_SCHEMA_GAP", null),
  m("sites", "TRANSFORM", "aurora", "industrial_sites", "READY", "Not tip facilities", "self"),
  m("super_admins", "EXCLUDE_WITH_APPROVAL", "none", "excluded/super_admins", "ARCHIVE_ONLY", "Platform admins", null),
  m("taskRecords", "TRANSFORM", "aurora", "industrial_tasks", "READY", "Live IND-11"),
  m("training_audit_logs", "ARCHIVE", "archive", "archive/training_audit_logs", "ARCHIVE_ONLY", "Audit stream", null),
  m("training_courses", "MERGE", "aurora", "industrial_training_records", "READY", "Merge into training records"),
  m("training_enrollments", "MERGE", "aurora", "industrial_training_records", "READY", "Merge into training records"),
  m("training_import_jobs", "ARCHIVE", "archive", "archive/training_import_jobs", "ARCHIVE_ONLY", "Import residue", null),
  m("warehouseSafetyRecords", "TRANSFORM", "aurora", "industrial_warehouse_safety_records", "PARTIAL", "Workbook family"),
  m("workersCompAuditEvents", "ARCHIVE", "archive", "archive/workers_comp_audit_events", "ARCHIVE_ONLY", "WC audit", null),
  m("workersCompCarriers", "ARCHIVE", "archive", "archive/workers_comp_carriers", "MISSING", "TARGET_SCHEMA_GAP + policy", null),
  m("workersCompCases", "TRANSFORM", "aurora", "industrial_workers_comp_cases", "PARTIAL", "Cases loaded IND-11; tip AMBIGUOUS"),
  m("workersCompDocuments", "TRANSFORM", "aurora+s3", "attachments/workers_comp_documents", "PARTIAL", "Document blobs + metadata"),
  m("workersCompImportJobs", "ARCHIVE", "archive", "archive/workers_comp_import_jobs", "ARCHIVE_ONLY", "Import residue", null),
  m("workersCompMedicalEncounters", "ARCHIVE", "archive", "archive/workers_comp_medical_encounters", "MISSING", "TARGET_SCHEMA_GAP + policy", null),
  m("workersCompRestrictions", "ARCHIVE", "archive", "archive/workers_comp_restrictions", "MISSING", "TARGET_SCHEMA_GAP + policy", null),
  m("workersCompWorkStatusPeriods", "ARCHIVE", "archive", "archive/workers_comp_work_status_periods", "MISSING", "TARGET_SCHEMA_GAP + policy", null),
  m("workingAtHeightsRecords", "TRANSFORM", "aurora", "industrial_working_at_heights_records", "PARTIAL", "Workbook family"),
];

export const MATRIX_BY_COLLECTION: Map<string, SourceTargetMapping> = new Map(
  SOURCE_TARGET_MATRIX.map((row) => [row.sourceCollection, row]),
);

export function assertMatrixComplete(rootCollections: string[]): string[] {
  const missing: string[] = [];
  const unknown: string[] = [];
  for (const c of rootCollections) {
    if (!MATRIX_BY_COLLECTION.has(c)) missing.push(c);
  }
  for (const row of SOURCE_TARGET_MATRIX) {
    if ((row as { disposition?: string }).disposition === "UNKNOWN") unknown.push(row.sourceCollection);
  }
  return [...missing.map((c) => `MISSING_MATRIX:${c}`), ...unknown.map((c) => `UNKNOWN_DISP:${c}`)];
}

export const TARGET_SCHEMA_GAPS: string[] = SOURCE_TARGET_MATRIX.filter(
  (r) => r.implementationStatus === "MISSING",
).map((r) => `${r.sourceCollection} → ${r.targetEntity} (${r.notes})`);
