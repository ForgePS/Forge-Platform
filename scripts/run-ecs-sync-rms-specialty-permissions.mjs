#!/usr/bin/env node
/**
 * Sync Phase 3 specialty permissions onto RMS_SYNTHETIC_ADMIN (no image rebuild required
 * when @forge/contracts already includes RMS_PERMISSIONS in the running task image).
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
import { RMS_PERMISSIONS } from "@forge/contracts";
import { LOCAL_PLACEHOLDER_ENV, loadEnvironmentAsync } from "@forge/environment";
import { and, eq, inArray } from "drizzle-orm";
import {
  createDatabase,
  permissions,
  rolePermissions,
  roles,
  tenants,
} from "@forge/database";

const env = await loadEnvironmentAsync({ ...LOCAL_PLACEHOLDER_ENV, ...process.env });
const db = createDatabase(env.DATABASE_URL);
const now = new Date();
const [tenant] = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.tenantKey, "rms-synthetic-fd")).limit(1);
if (!tenant) throw new Error("rms-synthetic-fd missing");
const [role] = await db.select().from(roles).where(and(eq(roles.tenantId, tenant.id), eq(roles.code, "RMS_SYNTHETIC_ADMIN"))).limit(1);
if (!role) throw new Error("RMS_SYNTHETIC_ADMIN missing");
const codes = [...RMS_PERMISSIONS, "platform.tenant.read", "platform.organization.read", "platform.person.read", "platform.feature.manage"];
const permRows = await db.select({ id: permissions.id, code: permissions.code }).from(permissions).where(inArray(permissions.code, codes));
let added = 0;
for (const perm of permRows) {
  const [existing] = await db.select().from(rolePermissions).where(and(eq(rolePermissions.roleId, role.id), eq(rolePermissions.permissionId, perm.id))).limit(1);
  if (existing) continue;
  await db.insert(rolePermissions).values({ roleId: role.id, permissionId: perm.id, effect: "ALLOW", createdAt: now });
  added += 1;
}
console.info(JSON.stringify({ ok: true, tenantId: tenant.id, roleId: role.id, permissionRows: permRows.length, added }));
process.exit(0);
`;

const { cluster, taskArn } = runPlatformApiOneOff(
  ["node", "--input-type=module", "-e", script],
  "sync-rms-specialty-permissions",
  { environment: { DATABASE_SECRET_ARN: adminSecretArn } },
);

console.log("Waiting for task to stop…");
const { spawnSync } = await import("node:child_process");
const wait = spawnSync(
  "aws",
  ["ecs", "wait", "tasks-stopped", "--cluster", cluster, "--tasks", taskArn],
  { encoding: "utf8", shell: true },
);
if (wait.status !== 0) {
  console.error(wait.stderr || wait.stdout);
  process.exit(1);
}

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
console.log(JSON.stringify({ taskArn, exitCode }));
process.exit(exitCode === 0 ? 0 : 1);
