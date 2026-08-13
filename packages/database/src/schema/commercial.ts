import {
  bigint,
  boolean,
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
import { subscriptions } from "./entitlements.js";
import { subscriptionPlans } from "./platform.js";
import { tenants } from "./tenants.js";
import { users } from "./users.js";

/**
 * Versioned commercial catalog entries for a subscription plan (platform-global).
 * Subscription-S1 foundation.
 */
export const subscriptionPlanVersions = pgTable(
  "subscription_plan_versions",
  {
    id: uuid("id").primaryKey(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => subscriptionPlans.id),
    versionNumber: integer("version_number").notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    billingFrequency: varchar("billing_frequency", { length: 32 }).notNull(),
    basePriceCents: integer("base_price_cents").notNull(),
    implementationFeeCents: integer("implementation_fee_cents").notNull().default(0),
    currency: varchar("currency", { length: 3 }).notNull().default("USD"),
    configurationJson: jsonb("configuration_json").notNull().default({}),
    status: varchar("status", { length: 32 }).notNull().default("DRAFT"),
    effectiveFrom: timestamp("effective_from", { withTimezone: true }),
    createdAt: createdAtColumn,
    updatedAt: updatedAtColumn,
  },
  (table) => [
    uniqueIndex("subscription_plan_versions_plan_version_uidx").on(
      table.planId,
      table.versionNumber,
    ),
  ],
);

export const subscriptionItems = pgTable("subscription_items", {
  id: uuid("id").primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  subscriptionId: uuid("subscription_id")
    .notNull()
    .references(() => subscriptions.id),
  itemType: varchar("item_type", { length: 32 }).notNull(),
  productCode: varchar("product_code", { length: 64 }),
  moduleCode: varchar("module_code", { length: 64 }),
  planVersionId: uuid("plan_version_id").references(() => subscriptionPlanVersions.id),
  description: varchar("description", { length: 500 }).notNull(),
  quantity: integer("quantity").notNull().default(1),
  unitPriceCents: integer("unit_price_cents").notNull().default(0),
  amountCents: integer("amount_cents").notNull().default(0),
  billingFrequency: varchar("billing_frequency", { length: 32 }).notNull().default("ANNUAL"),
  status: varchar("status", { length: 32 }).notNull().default("ACTIVE"),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  configurationJson: jsonb("configuration_json").notNull().default({}),
  recordVersion: recordVersionColumn,
  createdAt: createdAtColumn,
  updatedAt: updatedAtColumn,
});

export const subscriptionChanges = pgTable("subscription_changes", {
  id: uuid("id").primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  subscriptionId: uuid("subscription_id")
    .notNull()
    .references(() => subscriptions.id),
  changeType: varchar("change_type", { length: 64 }).notNull(),
  summary: text("summary").notNull(),
  beforeJson: jsonb("before_json").notNull().default({}),
  afterJson: jsonb("after_json").notNull().default({}),
  effectiveAt: timestamp("effective_at", { withTimezone: true }).notNull(),
  actorUserId: uuid("actor_user_id").references(() => users.id),
  createdAt: createdAtColumn,
});

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    subscriptionId: uuid("subscription_id").references(() => subscriptions.id),
    invoiceNumber: varchar("invoice_number", { length: 64 }).notNull(),
    status: varchar("status", { length: 32 }).notNull().default("DRAFT"),
    currency: varchar("currency", { length: 3 }).notNull().default("USD"),
    issueDate: timestamp("issue_date", { withTimezone: true }).notNull(),
    dueDate: timestamp("due_date", { withTimezone: true }).notNull(),
    subtotalCents: integer("subtotal_cents").notNull().default(0),
    discountCents: integer("discount_cents").notNull().default(0),
    taxCents: integer("tax_cents").notNull().default(0),
    creditCents: integer("credit_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull().default(0),
    amountPaidCents: integer("amount_paid_cents").notNull().default(0),
    balanceCents: integer("balance_cents").notNull().default(0),
    notes: text("notes"),
    billingProvider: varchar("billing_provider", { length: 64 }).notNull().default("MANUAL"),
    externalInvoiceId: varchar("external_invoice_id", { length: 255 }),
    finalizedAt: timestamp("finalized_at", { withTimezone: true }),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    recordVersion: recordVersionColumn,
    createdAt: createdAtColumn,
    updatedAt: updatedAtColumn,
  },
  (table) => [uniqueIndex("invoices_invoice_number_uidx").on(table.invoiceNumber)],
);

export const invoiceLineItems = pgTable("invoice_line_items", {
  id: uuid("id").primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  invoiceId: uuid("invoice_id")
    .notNull()
    .references(() => invoices.id),
  lineType: varchar("line_type", { length: 64 }).notNull(),
  description: varchar("description", { length: 500 }).notNull(),
  quantity: integer("quantity").notNull().default(1),
  unitPriceCents: integer("unit_price_cents").notNull().default(0),
  amountCents: integer("amount_cents").notNull().default(0),
  periodStart: timestamp("period_start", { withTimezone: true }),
  periodEnd: timestamp("period_end", { withTimezone: true }),
  productCode: varchar("product_code", { length: 64 }),
  moduleCode: varchar("module_code", { length: 64 }),
  createdAt: createdAtColumn,
});

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  paymentNumber: varchar("payment_number", { length: 64 }).notNull(),
  paymentDate: timestamp("payment_date", { withTimezone: true }).notNull(),
  amountCents: integer("amount_cents").notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("USD"),
  method: varchar("method", { length: 32 }).notNull().default("MANUAL"),
  reference: varchar("reference", { length: 255 }),
  notes: text("notes"),
  recordedByUserId: uuid("recorded_by_user_id").references(() => users.id),
  billingProvider: varchar("billing_provider", { length: 64 }).notNull().default("MANUAL"),
  externalPaymentId: varchar("external_payment_id", { length: 255 }),
  createdAt: createdAtColumn,
  updatedAt: updatedAtColumn,
});

export const paymentAllocations = pgTable("payment_allocations", {
  id: uuid("id").primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  paymentId: uuid("payment_id")
    .notNull()
    .references(() => payments.id),
  invoiceId: uuid("invoice_id")
    .notNull()
    .references(() => invoices.id),
  amountCents: integer("amount_cents").notNull(),
  createdAt: createdAtColumn,
});

export const accountCredits = pgTable("account_credits", {
  id: uuid("id").primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  creditNumber: varchar("credit_number", { length: 64 }).notNull(),
  reason: varchar("reason", { length: 500 }).notNull(),
  amountCents: integer("amount_cents").notNull(),
  appliedCents: integer("applied_cents").notNull().default(0),
  remainingCents: integer("remaining_cents").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  status: varchar("status", { length: 32 }).notNull().default("AVAILABLE"),
  createdByUserId: uuid("created_by_user_id").references(() => users.id),
  createdAt: createdAtColumn,
  updatedAt: updatedAtColumn,
});

/** Platform or tenant-scoped discount catalog (tenant_id null = platform). */
export const discountDefinitions = pgTable("discount_definitions", {
  id: uuid("id").primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id),
  code: varchar("code", { length: 64 }).notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  discountType: varchar("discount_type", { length: 32 }).notNull(),
  percentBps: integer("percent_bps"),
  amountCents: integer("amount_cents"),
  stackable: boolean("stackable").notNull().default(false),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  status: varchar("status", { length: 32 }).notNull().default("ACTIVE"),
  configurationJson: jsonb("configuration_json").notNull().default({}),
  createdAt: createdAtColumn,
  updatedAt: updatedAtColumn,
});

export const subscriptionDiscountLinks = pgTable("subscription_discount_links", {
  id: uuid("id").primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  subscriptionId: uuid("subscription_id")
    .notNull()
    .references(() => subscriptions.id),
  discountId: uuid("discount_id")
    .notNull()
    .references(() => discountDefinitions.id),
  reason: text("reason"),
  authorizedByUserId: uuid("authorized_by_user_id").references(() => users.id),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  createdAt: createdAtColumn,
});

export const subscriptionContracts = pgTable("subscription_contracts", {
  id: uuid("id").primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  subscriptionId: uuid("subscription_id")
    .notNull()
    .references(() => subscriptions.id),
  contractNumber: varchar("contract_number", { length: 64 }).notNull(),
  contractType: varchar("contract_type", { length: 64 }).notNull().default("MSA"),
  status: varchar("status", { length: 32 }).notNull().default("DRAFT"),
  title: varchar("title", { length: 300 }).notNull(),
  documentKey: varchar("document_key", { length: 512 }),
  effectiveFrom: timestamp("effective_from", { withTimezone: true }),
  effectiveTo: timestamp("effective_to", { withTimezone: true }),
  notes: text("notes"),
  createdAt: createdAtColumn,
  updatedAt: updatedAtColumn,
});

/** Platform-global number sequences for commercial documents. */
export const commercialSequences = pgTable(
  "commercial_sequences",
  {
    id: uuid("id").primaryKey(),
    sequenceKey: varchar("sequence_key", { length: 32 }).notNull(),
    lastValue: bigint("last_value", { mode: "number" }).notNull().default(0),
    prefix: varchar("prefix", { length: 16 }).notNull(),
    updatedAt: updatedAtColumn,
  },
  (table) => [uniqueIndex("commercial_sequences_key_uidx").on(table.sequenceKey)],
);
