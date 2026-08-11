import { index, jsonb, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { createdAtColumn, updatedAtColumn } from "./common.js";
import { tenants } from "./tenants.js";
import { users } from "./users.js";

/**
 * In-app notification inbox rows (MK-S13).
 * Email delivery is handled by the email provider abstraction; this table stores inbox state.
 */
export const userNotifications = pgTable(
  "user_notifications",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    type: varchar("type", { length: 120 }).notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    body: text("body").notNull(),
    priority: varchar("priority", { length: 32 }).notNull().default("NORMAL"),
    destination: varchar("destination", { length: 32 }).notNull().default("IN_APP"),
    href: varchar("href", { length: 500 }),
    readAt: timestamp("read_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    metadataJson: jsonb("metadata_json").notNull().default({}),
    createdAt: createdAtColumn,
    updatedAt: updatedAtColumn,
  },
  (table) => [
    index("user_notifications_tenant_user_created_idx").on(
      table.tenantId,
      table.userId,
      table.createdAt,
    ),
    index("user_notifications_tenant_user_unread_idx").on(
      table.tenantId,
      table.userId,
      table.readAt,
    ),
  ],
);

export type UserNotification = typeof userNotifications.$inferSelect;
