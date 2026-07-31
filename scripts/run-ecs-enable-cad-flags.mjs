#!/usr/bin/env node
/**
 * Enable Phase 4 CAD feature flags on rms-synthetic-fd only; remove from tenant B.
 * Grants non-raw-payload rms.cad.* permissions onto RMS_SYNTHETIC_ADMIN when present.
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
import { and, eq, isNull, like } from "drizzle-orm";
import {
  createDatabase,
  createId,
  featureDefinitions,
  featureOverrides,
  permissions,
  rolePermissions,
  roles,
  tenants,
  users,
} from "@forge/database";

const FLAG_KEYS = [
  "rms.cad.enabled",
  "rms.cad.webhook.enabled",
  "rms.cad.polling.enabled",
  "rms.cad.hybrid.enabled",
  "rms.cad.operations.enabled",
  "rms.cad.simulator.enabled",
];

const env = await loadEnvironmentAsync({ ...LOCAL_PLACEHOLDER_ENV, ...process.env });
const db = createDatabase(env.DATABASE_URL);
const [tenantA] = await db.select().from(tenants).where(eq(tenants.tenantKey, "rms-synthetic-fd")).limit(1);
const [tenantB] = await db.select().from(tenants).where(eq(tenants.tenantKey, "rms-synthetic-fd-b")).limit(1);
if (!tenantA) throw new Error("rms-synthetic-fd missing");

const [actor] = await db
  .select()
  .from(users)
  .where(and(eq(users.tenantId, tenantA.id), eq(users.primaryEmail, "admin@rms-synthetic.test")))
  .limit(1);
if (!actor) throw new Error("admin@rms-synthetic.test missing for created_by_user_id");

const report = { enabled: [], removedFromB: [], permissionsGranted: 0 };
const now = new Date();

for (const key of FLAG_KEYS) {
  const def = await db.query.featureDefinitions.findFirst({ where: eq(featureDefinitions.key, key) });
  if (!def) throw new Error("missing feature definition " + key);
  const existingA = await db.query.featureOverrides.findFirst({
    where: and(
      eq(featureOverrides.tenantId, tenantA.id),
      eq(featureOverrides.featureDefinitionId, def.id),
      isNull(featureOverrides.organizationId),
      isNull(featureOverrides.userId),
    ),
  });
  if (!existingA) {
    await db.insert(featureOverrides).values({
      id: createId(),
      tenantId: tenantA.id,
      featureDefinitionId: def.id,
      valueJson: true,
      reason: "Phase 4 CAD synthetic tenant A enablement",
      createdByUserId: actor.id,
      createdAt: now,
      updatedAt: now,
    });
  } else if (existingA.valueJson !== true) {
    await db
      .update(featureOverrides)
      .set({ valueJson: true, updatedAt: now })
      .where(eq(featureOverrides.id, existingA.id));
  }
  report.enabled.push(key);

  if (tenantB) {
    const existingB = await db.query.featureOverrides.findFirst({
      where: and(
        eq(featureOverrides.tenantId, tenantB.id),
        eq(featureOverrides.featureDefinitionId, def.id),
        isNull(featureOverrides.organizationId),
        isNull(featureOverrides.userId),
      ),
    });
    if (existingB) {
      await db.delete(featureOverrides).where(eq(featureOverrides.id, existingB.id));
      report.removedFromB.push(key);
    }
  }
}

const [adminRole] = await db
  .select()
  .from(roles)
  .where(and(eq(roles.tenantId, tenantA.id), eq(roles.code, "RMS_SYNTHETIC_ADMIN")))
  .limit(1);

if (adminRole) {
  const cadPermRows = await db.select().from(permissions).where(like(permissions.code, "rms.cad.%"));
  for (const perm of cadPermRows) {
    if (perm.code.includes("raw_payload")) continue;
    const existing = await db.query.rolePermissions.findFirst({
      where: and(eq(rolePermissions.roleId, adminRole.id), eq(rolePermissions.permissionId, perm.id)),
    });
    if (!existing) {
      await db.insert(rolePermissions).values({
        roleId: adminRole.id,
        permissionId: perm.id,
        createdAt: new Date(),
      });
      report.permissionsGranted += 1;
    }
  }
}

console.info(JSON.stringify({ ok: true, tenantA: tenantA.tenantKey, report }, null, 2));
process.exit(0);
`;

const { cluster, taskArn } = runPlatformApiOneOff(
  ["node", "--input-type=module", "-e", script],
  "enable-cad-flags-tenant-a",
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
      "get-log-events",
      "--log-group-name",
      "/forge/development/platform-api",
      "--log-stream-name",
      `platform-api/platform-api/${taskArn.split("/").pop()}`,
      "--limit",
      "8",
      "--query",
      "events[-1].message",
      "--output",
      "text",
    ],
    { encoding: "utf8", shell: true },
  ).stdout,
);
process.exit(exitCode === 0 ? 0 : 1);
