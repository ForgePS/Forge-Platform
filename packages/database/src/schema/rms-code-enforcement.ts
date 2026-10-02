import {
  doublePrecision,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
  date,
} from "drizzle-orm/pg-core";
import { createdAtColumn, recordVersionColumn, updatedAtColumn } from "./common.js";
import { rmsInspectionFindings, rmsInspections } from "./rms-prevention.js";
import { rmsOccupancies } from "./rms-master.js";
import { tenants } from "./tenants.js";

export const rmsCodeCases = pgTable(
  "rms_code_cases",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    caseNumber: varchar("case_number",{length:64}).notNull(),
    occupancyId: uuid("occupancy_id").notNull().references(() => rmsOccupancies.id),
    inspectionId: uuid("inspection_id").references(() => rmsInspections.id),
    caseType: varchar("case_type",{length:48}).notNull().default("VIOLATION"),
    status: varchar("status",{length:48}).notNull().default("OPEN"),
    openedAt: timestamp("opened_at",{withTimezone:true}).notNull(),
    complianceDueDate: date("compliance_due_date"),
    closedAt: timestamp("closed_at",{withTimezone:true}),
    responsibleParty: varchar("responsible_party",{length:200}),
    contactEmail: varchar("contact_email",{length:320}),
    contactPhone: varchar("contact_phone",{length:64}),
    summary: text("summary"),
    notes: text("notes"),
    recordVersion: recordVersionColumn,
    createdByUserId: uuid("created_by_user_id"),
    updatedByUserId: uuid("updated_by_user_id"),
    createdAt: createdAtColumn,
    updatedAt: updatedAtColumn,
    deletedAt: timestamp("deleted_at",{withTimezone:true}),
    deletedByUserId: uuid("deleted_by_user_id"),
  },
  (table)=>[
    uniqueIndex("rms_code_cases_tenant_number_uidx").on(table.tenantId,table.caseNumber),
    index("rms_code_cases_tenant_status_idx").on(table.tenantId,table.status),
    index("rms_code_cases_occupancy_idx").on(table.occupancyId),
    index("rms_code_cases_due_idx").on(table.tenantId,table.complianceDueDate),
  ],
);

export const rmsCodeViolations = pgTable(
  "rms_code_violations",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    caseId: uuid("case_id").notNull().references(() => rmsCodeCases.id),
    inspectionFindingId: uuid("inspection_finding_id").references(() => rmsInspectionFindings.id),
    codeReference: varchar("code_reference",{length:160}),
    title: varchar("title",{length:300}).notNull(),
    description: text("description"),
    severity: varchar("severity",{length:32}).notNull().default("MODERATE"),
    status: varchar("status",{length:32}).notNull().default("OPEN"),
    correctiveAction: text("corrective_action"),
    correctionDueDate: date("correction_due_date"),
    correctedAt: timestamp("corrected_at",{withTimezone:true}),
    verifiedAt: timestamp("verified_at",{withTimezone:true}),
    verificationNotes: text("verification_notes"),
    fineAmount: doublePrecision("fine_amount"),
    recordVersion: recordVersionColumn,
    createdByUserId: uuid("created_by_user_id"),
    updatedByUserId: uuid("updated_by_user_id"),
    createdAt: createdAtColumn,
    updatedAt: updatedAtColumn,
  },
  (table)=>[
    index("rms_code_violations_case_idx").on(table.caseId),
    index("rms_code_violations_tenant_status_due_idx").on(table.tenantId,table.status,table.correctionDueDate),
    index("rms_code_violations_finding_idx").on(table.inspectionFindingId),
  ],
);

export const rmsCodeNotices = pgTable(
  "rms_code_notices",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    caseId: uuid("case_id").notNull().references(() => rmsCodeCases.id),
    noticeType: varchar("notice_type",{length:64}).notNull().default("NOTICE_OF_VIOLATION"),
    issuedAt: timestamp("issued_at",{withTimezone:true}).notNull(),
    recipient: varchar("recipient",{length:300}),
    deliveryMethod: varchar("delivery_method",{length:64}),
    servedAt: timestamp("served_at",{withTimezone:true}),
    subject: varchar("subject",{length:300}),
    bodySnapshot: text("body_snapshot").notNull(),
    createdByUserId: uuid("created_by_user_id"),
    createdAt: createdAtColumn,
  },
  (table)=>[
    index("rms_code_notices_case_idx").on(table.caseId),
    index("rms_code_notices_tenant_issued_idx").on(table.tenantId,table.issuedAt),
  ],
);
