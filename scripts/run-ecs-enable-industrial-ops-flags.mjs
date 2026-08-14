#!/usr/bin/env node
/**
 * Enable IND-3 Industrial Operations feature flags for Producers Rice Mill (or matching tenant).
 * Also ensures industrial.enabled is true.
 */
import { awsText, runPlatformApiOneOff } from "./ecs-oneoff.mjs";

const adminSecretName =
  process.env.FORGE_ADMIN_DB_SECRET_NAME || "forge-development-secrets-database";
const adminSecretArn = awsText([
  "secretsmanager",
  "describe-secret",
  "--secret-id",
  adminSecretName,
  "--query",
  "ARN",
]);

const script = `
import { LOCAL_PLACEHOLDER_ENV, loadEnvironmentAsync } from "@forge/environment";
import { and, eq, ilike, isNull, or } from "drizzle-orm";
import {
  createDatabase,
  createId,
  featureDefinitions,
  featureOverrides,
  tenants,
  users,
} from "@forge/database";

/** Full industrial nav flag set (matches INDUSTRIAL_FEATURE_FLAGS in contracts). */
const FLAG_KEYS = [
  "industrial.enabled",
  "industrial.module.analytics.enabled",
  "industrial.module.personnel.enabled",
  "industrial.module.incidents.enabled",
  "industrial.module.inspections.enabled",
  "industrial.module.training.enabled",
  "industrial.module.jsa.enabled",
  "industrial.module.observations.enabled",
  "industrial.module.forms.enabled",
  "industrial.module.scan.enabled",
  "industrial.module.qr_links.enabled",
  "industrial.module.documents.enabled",
  "industrial.module.reporting.enabled",
  "industrial.module.loto.enabled",
  "industrial.module.equipment.enabled",
  "industrial.module.forklifts.enabled",
  "industrial.module.confined_space.enabled",
  "industrial.module.hot_work.enabled",
  "industrial.module.working_at_heights.enabled",
  "industrial.module.electrical_safety.enabled",
  "industrial.module.cranes_rigging.enabled",
  "industrial.module.machine_safety.enabled",
  "industrial.module.dot.enabled",
  "industrial.module.workers_comp.enabled",
  "industrial.module.osha.enabled",
  "industrial.module.risk.enabled",
  "industrial.module.chemical_safety.enabled",
  "industrial.module.warehouse_safety.enabled",
  "industrial.module.manufacturing_safety.enabled",
  "industrial.module.contractor_safety.enabled",
  "industrial.module.process_safety.enabled",
  "industrial.module.environmental_safety.enabled",
  "industrial.module.tasks.enabled",
  "industrial.module.messaging.enabled",
  "industrial.module.emergency_response.enabled",
];

const env = await loadEnvironmentAsync({ ...LOCAL_PLACEHOLDER_ENV, ...process.env });
const db = createDatabase(env.DATABASE_URL);

const candidates = await db
  .select()
  .from(tenants)
  .where(
    or(
      ilike(tenants.displayName, "%Producers%Rice%"),
      ilike(tenants.displayName, "%Rice Mill%"),
      ilike(tenants.tenantKey, "%rice%"),
      ilike(tenants.tenantKey, "%producers%"),
      eq(tenants.tenantKey, "producers-rice-mill"),
      eq(tenants.slug, "producers-rice-mill"),
      eq(tenants.id, "0882c865-59c2-49a6-ab88-ce6ca89be30c"),
    ),
  );

if (candidates.length === 0) {
  throw new Error("Producers Rice Mill tenant not found");
}

const [fallbackActor] = await db.select().from(users).limit(1);
const createdByUserId = fallbackActor?.id ?? null;
if (!createdByUserId) throw new Error("No user available for created_by_user_id");

const now = new Date();
const report = [];

async function ensureDefinition(key) {
  let def = await db.query.featureDefinitions.findFirst({ where: eq(featureDefinitions.key, key) });
  if (def) return def;
  const moduleSlug = key.replace(/^industrial\\.module\\./, "").replace(/\\.enabled$/, "");
  const label =
    key === "industrial.enabled"
      ? "Forge Industrial Safety"
      : moduleSlug
          .split("_")
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(" ");
  const id = createId();
  await db.insert(featureDefinitions).values({
    id,
    key,
    name: key === "industrial.enabled" ? label : \`Industrial \${label} module\`,
    description:
      key === "industrial.enabled"
        ? "Master switch for Forge Industrial Safety shell (CORE)."
        : \`Enable Industrial \${label} on AWS.\`,
    valueType: "BOOLEAN",
    defaultValueJson: key === "industrial.enabled",
    createdAt: now,
    updatedAt: now,
  });
  def = await db.query.featureDefinitions.findFirst({ where: eq(featureDefinitions.key, key) });
  if (!def) throw new Error("failed to create feature definition " + key);
  return def;
}

for (const tenant of candidates) {
  const enabled = [];
  const createdDefs = [];
  for (const key of FLAG_KEYS) {
    const before = await db.query.featureDefinitions.findFirst({ where: eq(featureDefinitions.key, key) });
    const def = await ensureDefinition(key);
    if (!before) createdDefs.push(key);
    const existing = await db.query.featureOverrides.findFirst({
      where: and(
        eq(featureOverrides.tenantId, tenant.id),
        eq(featureOverrides.featureDefinitionId, def.id),
        isNull(featureOverrides.organizationId),
        isNull(featureOverrides.userId),
      ),
    });
    if (!existing) {
      await db.insert(featureOverrides).values({
        id: createId(),
        tenantId: tenant.id,
        featureDefinitionId: def.id,
        valueJson: true,
        reason: "Enable all Industrial module flags on Producers (Wave 1)",
        createdByUserId,
        createdAt: now,
        updatedAt: now,
      });
    } else if (existing.valueJson !== true) {
      await db
        .update(featureOverrides)
        .set({ valueJson: true, updatedAt: now, reason: "Enable all Industrial module flags on Producers (Wave 1)" })
        .where(eq(featureOverrides.id, existing.id));
    }
    enabled.push(key);
  }
  report.push({
    tenantId: tenant.id,
    tenantKey: tenant.tenantKey,
    displayName: tenant.displayName,
    enabledCount: enabled.length,
    enabled,
    createdDefs,
  });
}

console.info(JSON.stringify({ ok: true, tenants: report }, null, 2));
process.exit(0);
`;

const { cluster, taskArn } = runPlatformApiOneOff(
  ["node", "--input-type=module", "-e", script],
  "enable-industrial-ops-flags",
  { environment: { DATABASE_SECRET_ARN: adminSecretArn } },
);

const { spawnSync } = await import("node:child_process");
spawnSync("aws", ["ecs", "wait", "tasks-stopped", "--cluster", cluster, "--tasks", taskArn], {
  encoding: "utf8",
  shell: true,
});
const desc = spawnSync(
  "aws",
  [
    "ecs",
    "describe-tasks",
    "--cluster",
    cluster,
    "--tasks",
    taskArn,
    "--query",
    "tasks[0].containers[0].exitCode",
    "--output",
    "text",
  ],
  { encoding: "utf8", shell: true },
);
const exitCode = Number((desc.stdout || "").trim());
console.log(
  spawnSync(
    "aws",
    [
      "logs",
      "filter-log-events",
      "--log-group-name",
      "/forge/development/platform-api",
      "--start-time",
      String(Date.now() - 15 * 60 * 1000),
      "--filter-pattern",
      "enable",
      "--limit",
      "20",
      "--query",
      "events[-5:].message",
      "--output",
      "text",
    ],
    { encoding: "utf8", shell: true },
  ).stdout,
);
process.exit(exitCode === 0 ? 0 : 1);
