import {
  date,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { createdAtColumn, recordVersionColumn, updatedAtColumn } from "./common.js";
import { rmsOccupancies } from "./rms-master.js";
import { nerisIncidents } from "./neris-incidents.js";
import { tenants } from "./tenants.js";

export const rmsInvestigationCases = pgTable(
  "rms_investigation_cases",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    caseNumber: varchar("case_number",{length:64}).notNull(),
    incidentId: uuid("incident_id").references(() => nerisIncidents.id),
    occupancyId: uuid("occupancy_id").references(() => rmsOccupancies.id),
    caseType: varchar("case_type",{length:64}).notNull().default("FIRE_INVESTIGATION"),
    leadInvestigator: varchar("lead_investigator",{length:200}),
    status: varchar("status",{length:48}).notNull().default("OPEN"),
    openedAt: timestamp("opened_at",{withTimezone:true}).notNull(),
    closedAt: timestamp("closed_at",{withTimezone:true}),
    location: text("location"),
    sceneStatus: varchar("scene_status",{length:32}),
    weather: varchar("weather",{length:200}),
    initialObservations: text("initial_observations"),
    areaOfOrigin: text("area_of_origin"),
    causeClassification: varchar("cause_classification",{length:64}),
    causeNarrative: text("cause_narrative"),
    disposition: varchar("disposition",{length:120}),
    supervisorReviewStatus: varchar("supervisor_review_status",{length:32}).notNull().default("NOT_SUBMITTED"),
    supervisorReviewer: varchar("supervisor_reviewer",{length:200}),
    supervisorReviewedAt: timestamp("supervisor_reviewed_at",{withTimezone:true}),
    supervisorNotes: text("supervisor_notes"),
    recordVersion: recordVersionColumn,
    createdByUserId: uuid("created_by_user_id"),
    updatedByUserId: uuid("updated_by_user_id"),
    createdAt: createdAtColumn,
    updatedAt: updatedAtColumn,
    deletedAt: timestamp("deleted_at",{withTimezone:true}),
    deletedByUserId: uuid("deleted_by_user_id"),
  },
  (table)=>[
    uniqueIndex("rms_investigation_cases_tenant_number_uidx").on(table.tenantId,table.caseNumber),
    index("rms_investigation_cases_tenant_status_idx").on(table.tenantId,table.status),
    index("rms_investigation_cases_incident_idx").on(table.incidentId),
    index("rms_investigation_cases_occupancy_idx").on(table.occupancyId),
  ],
);

export const rmsInvestigationEvidence = pgTable(
  "rms_investigation_evidence",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    caseId: uuid("case_id").notNull().references(() => rmsInvestigationCases.id),
    evidenceType: varchar("evidence_type",{length:48}).notNull(),
    tagNumber: varchar("tag_number",{length:80}).notNull(),
    title: varchar("title",{length:300}),
    description: text("description"),
    collectedAt: timestamp("collected_at",{withTimezone:true}),
    collectedBy: varchar("collected_by",{length:200}),
    currentCustodian: varchar("current_custodian",{length:200}),
    storageLocation: varchar("storage_location",{length:300}),
    status: varchar("status",{length:32}).notNull().default("IN_CUSTODY"),
    notes: text("notes"),
    recordVersion: recordVersionColumn,
    createdByUserId: uuid("created_by_user_id"),
    updatedByUserId: uuid("updated_by_user_id"),
    createdAt: createdAtColumn,
    updatedAt: updatedAtColumn,
  },
  (table)=>[
    uniqueIndex("rms_investigation_evidence_case_tag_uidx").on(table.tenantId,table.caseId,table.tagNumber),
    index("rms_investigation_evidence_case_idx").on(table.caseId),
  ],
);

export const rmsInvestigationCustodyEvents = pgTable(
  "rms_investigation_custody_events",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    evidenceId: uuid("evidence_id").notNull().references(() => rmsInvestigationEvidence.id),
    action: varchar("action",{length:48}).notNull(),
    occurredAt: timestamp("occurred_at",{withTimezone:true}).notNull(),
    fromCustodian: varchar("from_custodian",{length:200}),
    toCustodian: varchar("to_custodian",{length:200}),
    location: varchar("location",{length:300}),
    notes: text("notes"),
    createdByUserId: uuid("created_by_user_id"),
    createdAt: createdAtColumn,
  },
  (table)=>[
    index("rms_investigation_custody_evidence_time_idx").on(table.evidenceId,table.occurredAt),
    index("rms_investigation_custody_tenant_idx").on(table.tenantId),
  ],
);
