import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import {createdAtColumn,recordVersionColumn,updatedAtColumn} from "./common.js";
import {rmsPersonnel,rmsShifts,rmsStations,rmsUnits} from "./rms-master.js";
import {tenants} from "./tenants.js";

export const rmsScheduleAssignments=pgTable("rms_schedule_assignments",{
  id:uuid("id").primaryKey(),
  tenantId:uuid("tenant_id").notNull().references(()=>tenants.id),
  personnelId:uuid("personnel_id").notNull().references(()=>rmsPersonnel.id),
  shiftId:uuid("shift_id").references(()=>rmsShifts.id),
  stationId:uuid("station_id").references(()=>rmsStations.id),
  unitId:uuid("unit_id").references(()=>rmsUnits.id),
  startAt:timestamp("start_at",{withTimezone:true}).notNull(),
  endAt:timestamp("end_at",{withTimezone:true}).notNull(),
  assignmentType:varchar("assignment_type",{length:48}).notNull().default("DUTY"),
  role:varchar("role",{length:80}),
  status:varchar("status",{length:32}).notNull().default("SCHEDULED"),
  eligibilityStatus:varchar("eligibility_status",{length:32}).notNull().default("UNKNOWN"),
  eligibilityWarningsJson:jsonb("eligibility_warnings_json").notNull().default([]),
  notes:text("notes"),
  recordVersion:recordVersionColumn,
  createdByUserId:uuid("created_by_user_id"),
  updatedByUserId:uuid("updated_by_user_id"),
  createdAt:createdAtColumn,
  updatedAt:updatedAtColumn,
  deletedAt:timestamp("deleted_at",{withTimezone:true}),
  deletedByUserId:uuid("deleted_by_user_id"),
},table=>[
  index("rms_schedule_assignments_personnel_time_idx").on(table.tenantId,table.personnelId,table.startAt,table.endAt),
  index("rms_schedule_assignments_station_time_idx").on(table.tenantId,table.stationId,table.startAt),
  index("rms_schedule_assignments_unit_time_idx").on(table.tenantId,table.unitId,table.startAt),
]);

export const rmsTimeOffRequests=pgTable("rms_time_off_requests",{
  id:uuid("id").primaryKey(),
  tenantId:uuid("tenant_id").notNull().references(()=>tenants.id),
  personnelId:uuid("personnel_id").notNull().references(()=>rmsPersonnel.id),
  startAt:timestamp("start_at",{withTimezone:true}).notNull(),
  endAt:timestamp("end_at",{withTimezone:true}).notNull(),
  leaveType:varchar("leave_type",{length:48}).notNull().default("VACATION"),
  status:varchar("status",{length:32}).notNull().default("PENDING"),
  reason:text("reason"),
  reviewer:varchar("reviewer",{length:200}),
  reviewedAt:timestamp("reviewed_at",{withTimezone:true}),
  reviewNotes:text("review_notes"),
  recordVersion:recordVersionColumn,
  createdByUserId:uuid("created_by_user_id"),
  updatedByUserId:uuid("updated_by_user_id"),
  createdAt:createdAtColumn,
  updatedAt:updatedAtColumn,
},table=>[
  index("rms_time_off_personnel_time_idx").on(table.tenantId,table.personnelId,table.startAt,table.endAt),
  index("rms_time_off_status_idx").on(table.tenantId,table.status,table.startAt),
]);

export const rmsShiftSwapRequests=pgTable("rms_shift_swap_requests",{
  id:uuid("id").primaryKey(),
  tenantId:uuid("tenant_id").notNull().references(()=>tenants.id),
  offeredAssignmentId:uuid("offered_assignment_id").notNull().references(()=>rmsScheduleAssignments.id),
  requesterPersonnelId:uuid("requester_personnel_id").notNull().references(()=>rmsPersonnel.id),
  replacementPersonnelId:uuid("replacement_personnel_id").references(()=>rmsPersonnel.id),
  targetPersonnelId:uuid("target_personnel_id").references(()=>rmsPersonnel.id),
  status:varchar("status",{length:32}).notNull().default("PENDING"),
  reason:text("reason"),
  reviewer:varchar("reviewer",{length:200}),
  reviewedAt:timestamp("reviewed_at",{withTimezone:true}),
  reviewNotes:text("review_notes"),
  recordVersion:recordVersionColumn,
  createdByUserId:uuid("created_by_user_id"),
  updatedByUserId:uuid("updated_by_user_id"),
  createdAt:createdAtColumn,
  updatedAt:updatedAtColumn,
},table=>[
  index("rms_shift_swap_status_idx").on(table.tenantId,table.status,table.createdAt),
  index("rms_shift_swap_requester_idx").on(table.tenantId,table.requesterPersonnelId),
  index("rms_shift_swap_assignment_idx").on(table.offeredAssignmentId),
]);
