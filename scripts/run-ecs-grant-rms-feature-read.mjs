#!/usr/bin/env node
/**
 * Grant platform.feature.manage to the synthetic RMS admin role (development acceptance).
 *
 * Usage:
 *   node scripts/run-ecs-grant-rms-feature-read.mjs
 */
import { spawnSync } from "node:child_process";
import { runPlatformApiOneOff } from "./ecs-oneoff.mjs";

const script = `
import { LOCAL_PLACEHOLDER_ENV, loadEnvironmentAsync } from "@forge/environment";
import { and, eq } from "drizzle-orm";
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
if (!tenant) throw new Error("tenant missing");
const [role] = await db.select({ id: roles.id }).from(roles).where(and(eq(roles.tenantId, tenant.id), eq(roles.code, "RMS_SYNTHETIC_ADMIN"))).limit(1);
if (!role) throw new Error("role missing");
const [perm] = await db.select({ id: permissions.id }).from(permissions).where(eq(permissions.code, "platform.feature.manage")).limit(1);
if (!perm) throw new Error("permission missing");
const [existing] = await db.select().from(rolePermissions).where(and(eq(rolePermissions.roleId, role.id), eq(rolePermissions.permissionId, perm.id))).limit(1);
if (!existing) {
  await db.insert(rolePermissions).values({ roleId: role.id, permissionId: perm.id, effect: "ALLOW", createdAt: now });
  console.info(JSON.stringify({ ok: true, created: true, roleId: role.id, permissionId: perm.id }));
} else {
  console.info(JSON.stringify({ ok: true, created: false, roleId: role.id, permissionId: perm.id }));
}
process.exit(0);
`;

const { cluster, taskArn } = runPlatformApiOneOff(
  ["node", "--input-type=module", "-e", script],
  "grant-rms-feature-read",
);

console.log("Waiting for task to stop…");
const wait = spawnSync(
  "aws",
  ["ecs", "wait", "tasks-stopped", "--cluster", cluster, "--tasks", taskArn],
  { encoding: "utf8", shell: true, stdio: "inherit" },
);
if (wait.status !== 0) process.exit(wait.status ?? 1);

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
    "tasks[0].containers[0].{exitCode:exitCode,reason:reason}",
    "--output",
    "json",
  ],
  { encoding: "utf8", shell: true },
);
console.log(desc.stdout);
const parsed = JSON.parse(desc.stdout || "{}");
if (parsed.exitCode !== 0) {
  console.error("Task failed — check CloudWatch logs for platform-api");
  process.exit(1);
}
