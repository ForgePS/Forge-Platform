export const RMS_FEATURE_FLAGS = {
  incidentShell: "rms.neris.incident_shell.enabled",
  manualIntake: "rms.neris.manual_intake.enabled",
  officerReview: "rms.neris.officer_review.enabled",
  tenantConfiguration: "rms.neris.tenant_configuration.enabled",
  specialtyWorkflows: "rms.neris.specialty_workflows.enabled",
  cadEnabled: "rms.cad.enabled",
  cadOperations: "rms.cad.operations.enabled",
  cadHybrid: "rms.cad.hybrid.enabled",
  aiNarrativeEnabled: "ai.narrative.enabled",
  aiNarrativeRmsEnabled: "ai.narrative.rms.enabled",
  aiNarrativeRewriteEnabled: "ai.narrative.rewrite.enabled",
  aiNarrativeQualityCheckEnabled: "ai.narrative.quality_check.enabled",
} as const;

/** FX presentation flags — see `src/fx/flags/rms-fx-flags.ts` (default off). */
export { RMS_FX_FEATURE_FLAGS } from "@/fx/flags/rms-fx-flags";

export const INCIDENT_SECTIONS = [
  { key: "OVERVIEW", label: "Overview" },
  { key: "DISPATCH", label: "Dispatch" },
  { key: "LOCATION", label: "Location" },
  { key: "UNITS_PERSONNEL", label: "Units & Personnel" },
  { key: "CLASSIFICATION", label: "Classification" },
  { key: "FIRE", label: "Fire" },
  { key: "STRUCTURE", label: "Structure" },
  { key: "WILDLAND", label: "Wildland" },
  { key: "HAZMAT", label: "Hazmat" },
  { key: "RESCUE", label: "Rescue" },
  { key: "EXPLOSION", label: "Explosion" },
  { key: "EXPOSURES", label: "Exposures" },
  { key: "CIVILIAN_CASUALTIES", label: "Civilian Casualties" },
  { key: "FIRE_SERVICE_CASUALTIES", label: "Fire Service Casualties" },
  { key: "ALARM_DETECTION", label: "Alarm & Detection" },
  { key: "FIRE_PROTECTION", label: "Fire Protection Systems" },
  { key: "EMERGING_HAZARDS", label: "Emerging Hazards" },
  { key: "RISK_REDUCTION", label: "Risk Reduction" },
  { key: "INCIDENT_ANALYSIS", label: "Incident Analysis" },
  { key: "NARRATIVE", label: "Narrative" },
  { key: "ATTACHMENTS", label: "Attachments" },
  { key: "REVIEW", label: "Review" },
] as const;

export type IncidentSectionKey = (typeof INCIDENT_SECTIONS)[number]["key"];

export const REVIEW_STATUSES = [
  "READY_FOR_REVIEW",
  "SUBMITTED_FOR_REVIEW",
  "RETURNED_FOR_CORRECTION",
  "APPROVED",
] as const;
