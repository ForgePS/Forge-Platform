import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  TENANT_RLS_TABLES,
  NULLABLE_TENANT_RLS_TABLES,
} from "./rls.sql.js";
import {
  addCents,
  computeArrCents,
  computeMrrCents,
  formatUsd,
  percentOfCents,
  prorateCents,
} from "./money.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationPath = path.join(__dirname, "../drizzle/0030_subscription_commercial_s1.sql");

describe("money re-exports", () => {
  it("delegates to contracts helpers", () => {
    expect(formatUsd(250)).toBe("$2.50");
    expect(addCents(100, 25)).toBe(125);
    expect(percentOfCents(200, 5000)).toBe(100);
    expect(computeArrCents(100, "MONTHLY")).toBe(1200);
    expect(computeMrrCents(1200, "ANNUAL")).toBe(100);
    expect(
      prorateCents({
        amountCents: 100,
        periodStart: "2026-01-01T00:00:00.000Z",
        periodEnd: "2026-01-11T00:00:00.000Z",
        effectiveFrom: "2026-01-06T00:00:00.000Z",
        method: "DAILY",
      }),
    ).toBe(50);
  });
});

describe("0030 subscription commercial migration", () => {
  const sql = readFileSync(migrationPath, "utf8");

  it("alters subscriptions and creates commercial tables", () => {
    expect(sql).toContain('ALTER TABLE "subscriptions"');
    expect(sql).toContain('"subscription_number"');
    expect(sql).toContain('"commercial_status"');
    for (const table of [
      "subscription_plan_versions",
      "subscription_items",
      "subscription_changes",
      "invoices",
      "invoice_line_items",
      "payments",
      "payment_allocations",
      "account_credits",
      "discount_definitions",
      "subscription_discount_links",
      "subscription_contracts",
      "commercial_sequences",
    ]) {
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS "${table}"`);
    }
  });

  it("seeds sequences and development plans", () => {
    expect(sql).toContain("IND_ANNUAL_STANDARD");
    expect(sql).toContain("RMS_ANNUAL_STANDARD");
    expect(sql).toContain("ACADEMY_ANNUAL_STANDARD");
    expect(sql).toContain("'INVOICE'");
    expect(sql).toContain("'PAYMENT'");
  });

  it("enables FORCE RLS on tenant commercial tables", () => {
    for (const table of [
      "subscription_items",
      "invoices",
      "payments",
      "account_credits",
      "subscription_contracts",
    ]) {
      expect(sql).toContain(`'${table}'`);
    }
    expect(sql).toContain("FORCE ROW LEVEL SECURITY");
    expect(sql).toContain("discount_definitions_tenant_isolation");
  });
});

describe("commercial RLS table registry", () => {
  it("lists new tenant commercial tables", () => {
    for (const table of [
      "subscription_items",
      "subscription_changes",
      "invoices",
      "invoice_line_items",
      "payments",
      "payment_allocations",
      "account_credits",
      "subscription_discount_links",
      "subscription_contracts",
    ]) {
      expect(TENANT_RLS_TABLES).toContain(table);
    }
    expect(NULLABLE_TENANT_RLS_TABLES).toContain("discount_definitions");
  });
});
