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

const FLAG_KEYS = [
  "industrial.enabled",
  "industrial.module.personnel.enabled",
  "industrial.module.incidents.enabled",
  "industrial.module.inspections.enabled",
  "industrial.module.training.enabled",
  "industrial.module.jsa.enabled",
  "industrial.module.observations.enabled",
  "industrial.module.forms.enabled",
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

for (const tenant of candidates) {
  const enabled = [];
  for (const key of FLAG_KEYS) {
    const def = await db.query.featureDefinitions.findFirst({ where: eq(featureDefinitions.key, key) });
    if (!def) throw new Error("missing feature definition " + key);
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
        reason: "Enable Industrial Operations IND-3 on Producers Rice Mill tenants",
        createdByUserId,
        createdAt: now,
        updatedAt: now,
      });
    } else if (existing.valueJson !== true) {
      await db
        .update(featureOverrides)
        .set({ valueJson: true, updatedAt: now })
        .where(eq(featureOverrides.id, existing.id));
    }
    enabled.push(key);
  }
  report.push({
    tenantId: tenant.id,
    tenantKey: tenant.tenantKey,
    displayName: tenant.displayName,
    enabled,
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
