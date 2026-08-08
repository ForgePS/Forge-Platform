import { index, jsonb, pgTable, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { createdAtColumn, recordVersionColumn, updatedAtColumn } from "./common.js";
import { tenants } from "./tenants.js";

/**
 * Thin vertical-slice store for Industrial Operations modules (IND-3).
 * One row per record; module-specific fields live in payload JSON.
 */
export const industrialOpsRecords = pgTable(
  "industrial_ops_records",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    module: varchar("module", { length: 64 }).notNull(),
    title: varchar("title", { length: 500 }).notNull(),
    status: varchar("status", { length: 64 }).notNull().default("ACTIVE"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    recordVersion: recordVersionColumn,
    createdAt: createdAtColumn,
    updatedAt: updatedAtColumn,
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (table) => [
    index("industrial_ops_records_tenant_module_idx").on(table.tenantId, table.module),
    index("industrial_ops_records_tenant_status_idx").on(table.tenantId, table.status),
    uniqueIndex("industrial_ops_records_tenant_id_uidx").on(table.tenantId, table.id),
  ],
);
