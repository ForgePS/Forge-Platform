import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { createdAtColumn, recordVersionColumn, updatedAtColumn } from "./common.js";
import { rmsOccupancies } from "./rms-master.js";
import { tenants } from "./tenants.js";

export const rmsInspectionPrograms = pgTable(
  "rms_inspection_programs",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    name: varchar("name",{length:200}).notNull(),
    code: varchar("code",{length:64}),
    description: text("description"),
    active: boolean("active").notNull().default(true),
    frequency: varchar("frequency",{length:80}),
    recordVersion: recordVersionColumn,
    createdByUserId: uuid("created_by_user_id"),
    updatedByUserId: uuid("updated_by_user_id"),
    createdAt: createdAtColumn,
    updatedAt: updatedAtColumn,
    deletedAt: timestamp("deleted_at",{withTimezone:true}),
    deletedByUserId: uuid("deleted_by_user_id"),
  },
  (table)=>[
    uniqueIndex("rms_inspection_programs_tenant_name_uidx").on(table.tenantId,table.name),
    index("rms_inspection_programs_tenant_active_idx").on(table.tenantId,table.active),
  ],
);

export const rmsInspectionTemplates = pgTable(
  "rms_inspection_templates",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    programId: uuid("program_id").references(() => rmsInspectionPrograms.id),
    name: varchar("name",{length:200}).notNull(),
    lifecycleStatus: varchar("lifecycle_status",{length:32}).notNull().default("DRAFT"),
    version: integer("version").notNull().default(1),
    sectionsJson: jsonb("sections_json").$type<Array<Record<string,unknown>>>().notNull().default([]),
    publishedAt: timestamp("published_at",{withTimezone:true}),
    recordVersion: recordVersionColumn,
    createdByUserId: uuid("created_by_user_id"),
    updatedByUserId: uuid("updated_by_user_id"),
    createdAt: createdAtColumn,
    updatedAt: updatedAtColumn,
    deletedAt: timestamp("deleted_at",{withTimezone:true}),
    deletedByUserId: uuid("deleted_by_user_id"),
  },
  (table)=>[
    index("rms_inspection_templates_program_idx").on(table.programId),
    index("rms_inspection_templates_tenant_status_idx").on(table.tenantId,table.lifecycleStatus),
  ],
);

export const rmsInspections = pgTable(
  "rms_inspections",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    occupancyId: uuid("occupancy_id").notNull().references(() => rmsOccupancies.id),
    programId: uuid("program_id").references(() => rmsInspectionPrograms.id),
    templateId: uuid("template_id").references(() => rmsInspectionTemplates.id),
    inspectorName: varchar("inspector_name",{length:200}),
    inspectionDate: date("inspection_date").notNull(),
    scheduledDate: date("scheduled_date"),
    startedAt: timestamp("started_at",{withTimezone:true}),
    completedAt: timestamp("completed_at",{withTimezone:true}),
    status: varchar("status",{length:32}).notNull().default("SCHEDULED"),
    overallResult: varchar("overall_result",{length:32}).notNull().default("PENDING"),
    followUpDate: date("follow_up_date"),
    notes: text("notes"),
    checklistSnapshotJson: jsonb("checklist_snapshot_json").$type<Array<Record<string,unknown>>>().notNull().default([]),
    recordVersion: recordVersionColumn,
    createdByUserId: uuid("created_by_user_id"),
    updatedByUserId: uuid("updated_by_user_id"),
    createdAt: createdAtColumn,
    updatedAt: updatedAtColumn,
    deletedAt: timestamp("deleted_at",{withTimezone:true}),
    deletedByUserId: uuid("deleted_by_user_id"),
  },
  (table)=>[
    index("rms_inspections_tenant_status_idx").on(table.tenantId,table.status),
    index("rms_inspections_occupancy_date_idx").on(table.occupancyId,table.inspectionDate),
    index("rms_inspections_followup_idx").on(table.tenantId,table.followUpDate),
  ],
);

export const rmsInspectionResponses = pgTable(
  "rms_inspection_responses",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    inspectionId: uuid("inspection_id").notNull().references(() => rmsInspections.id),
    sectionId: varchar("section_id",{length:120}),
    fieldKey: varchar("field_key",{length:160}).notNull(),
    fieldLabel: varchar("field_label",{length:300}),
    result: varchar("result",{length:32}),
    valueJson: jsonb("value_json").$type<unknown>(),
    comment: text("comment"),
    recordVersion: recordVersionColumn,
    createdByUserId: uuid("created_by_user_id"),
    updatedByUserId: uuid("updated_by_user_id"),
    createdAt: createdAtColumn,
    updatedAt: updatedAtColumn,
  },
  (table)=>[
    uniqueIndex("rms_inspection_responses_field_uidx").on(table.tenantId,table.inspectionId,table.fieldKey),
    index("rms_inspection_responses_inspection_idx").on(table.inspectionId),
  ],
);

export const rmsInspectionFindings = pgTable(
  "rms_inspection_findings",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    inspectionId: uuid("inspection_id").notNull().references(() => rmsInspections.id),
    responseId: uuid("response_id").references(() => rmsInspectionResponses.id),
    title: varchar("title",{length:300}).notNull(),
    description: text("description"),
    severity: varchar("severity",{length:32}).notNull().default("MODERATE"),
    correctiveAction: text("corrective_action"),
    responsibleParty: varchar("responsible_party",{length:200}),
    dueDate: date("due_date"),
    status: varchar("status",{length:32}).notNull().default("OPEN"),
    correctedAt: timestamp("corrected_at",{withTimezone:true}),
    verifiedAt: timestamp("verified_at",{withTimezone:true}),
    verificationNotes: text("verification_notes"),
    recordVersion: recordVersionColumn,
    createdByUserId: uuid("created_by_user_id"),
    updatedByUserId: uuid("updated_by_user_id"),
    createdAt: createdAtColumn,
    updatedAt: updatedAtColumn,
  },
  (table)=>[
    index("rms_inspection_findings_inspection_idx").on(table.inspectionId),
    index("rms_inspection_findings_tenant_status_due_idx").on(table.tenantId,table.status,table.dueDate),
  ],
);
