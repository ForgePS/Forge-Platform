import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { createdAtColumn, recordVersionColumn, updatedAtColumn } from "./common.js";
import { rmsPersonnel } from "./rms-master.js";
import { tenants } from "./tenants.js";

export const rmsTrainingCourses = pgTable(
  "rms_training_courses",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    code: varchar("code",{length:64}).notNull(),
    title: varchar("title",{length:240}).notNull(),
    category: varchar("category",{length:80}).notNull().default("GENERAL"),
    description: text("description"),
    deliveryMode: varchar("delivery_mode",{length:48}).notNull().default("IN_PERSON"),
    defaultHours: doublePrecision("default_hours"),
    recurrenceMonths: integer("recurrence_months"),
    requiredForIncidentEligibility: boolean("required_for_incident_eligibility").notNull().default(false),
    status: varchar("status",{length:32}).notNull().default("ACTIVE"),
    recordVersion: recordVersionColumn,
    createdByUserId: uuid("created_by_user_id"),
    updatedByUserId: uuid("updated_by_user_id"),
    createdAt: createdAtColumn,
    updatedAt: updatedAtColumn,
    deletedAt: timestamp("deleted_at",{withTimezone:true}),
    deletedByUserId: uuid("deleted_by_user_id"),
  },
  (table)=>[
    uniqueIndex("rms_training_courses_tenant_code_uidx").on(table.tenantId,table.code),
    index("rms_training_courses_tenant_status_idx").on(table.tenantId,table.status),
    index("rms_training_courses_category_idx").on(table.tenantId,table.category),
  ],
);

export const rmsTrainingRecords = pgTable(
  "rms_training_records",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    courseId: uuid("course_id").notNull().references(() => rmsTrainingCourses.id),
    personnelId: uuid("personnel_id").notNull().references(() => rmsPersonnel.id),
    completedAt: timestamp("completed_at",{withTimezone:true}).notNull(),
    expiresAt: timestamp("expires_at",{withTimezone:true}),
    hours: doublePrecision("hours"),
    status: varchar("status",{length:32}).notNull().default("COMPLETED"),
    instructor: varchar("instructor",{length:200}),
    location: varchar("location",{length:300}),
    score: doublePrecision("score"),
    certificateNumber: varchar("certificate_number",{length:160}),
    notes: text("notes"),
    source: varchar("source",{length:64}).notNull().default("MANUAL"),
    recordVersion: recordVersionColumn,
    createdByUserId: uuid("created_by_user_id"),
    updatedByUserId: uuid("updated_by_user_id"),
    createdAt: createdAtColumn,
    updatedAt: updatedAtColumn,
  },
  (table)=>[
    index("rms_training_records_personnel_idx").on(table.tenantId,table.personnelId,table.completedAt),
    index("rms_training_records_course_idx").on(table.tenantId,table.courseId,table.completedAt),
    index("rms_training_records_expiry_idx").on(table.tenantId,table.expiresAt),
  ],
);

export const rmsCertificationTypes = pgTable(
  "rms_certification_types",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    code: varchar("code",{length:64}).notNull(),
    name: varchar("name",{length:240}).notNull(),
    issuingAuthority: varchar("issuing_authority",{length:240}),
    category: varchar("category",{length:80}).notNull().default("GENERAL"),
    defaultValidityMonths: integer("default_validity_months"),
    requiredForIncidentEligibility: boolean("required_for_incident_eligibility").notNull().default(false),
    status: varchar("status",{length:32}).notNull().default("ACTIVE"),
    recordVersion: recordVersionColumn,
    createdByUserId: uuid("created_by_user_id"),
    updatedByUserId: uuid("updated_by_user_id"),
    createdAt: createdAtColumn,
    updatedAt: updatedAtColumn,
    deletedAt: timestamp("deleted_at",{withTimezone:true}),
    deletedByUserId: uuid("deleted_by_user_id"),
  },
  (table)=>[
    uniqueIndex("rms_certification_types_tenant_code_uidx").on(table.tenantId,table.code),
    index("rms_certification_types_tenant_status_idx").on(table.tenantId,table.status),
  ],
);

export const rmsPersonnelCertifications = pgTable(
  "rms_personnel_certifications",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    personnelId: uuid("personnel_id").notNull().references(() => rmsPersonnel.id),
    certificationTypeId: uuid("certification_type_id").notNull().references(() => rmsCertificationTypes.id),
    credentialNumber: varchar("credential_number",{length:160}),
    issuedAt: date("issued_at"),
    expiresAt: date("expires_at"),
    status: varchar("status",{length:32}).notNull().default("ACTIVE"),
    verifiedAt: timestamp("verified_at",{withTimezone:true}),
    verifiedBy: varchar("verified_by",{length:200}),
    notes: text("notes"),
    recordVersion: recordVersionColumn,
    createdByUserId: uuid("created_by_user_id"),
    updatedByUserId: uuid("updated_by_user_id"),
    createdAt: createdAtColumn,
    updatedAt: updatedAtColumn,
  },
  (table)=>[
    index("rms_personnel_certifications_personnel_idx").on(table.tenantId,table.personnelId,table.status),
    index("rms_personnel_certifications_type_idx").on(table.tenantId,table.certificationTypeId),
    index("rms_personnel_certifications_expiry_idx").on(table.tenantId,table.expiresAt),
  ],
);
