#!/usr/bin/env node
/**
 * Link Cognito subject → synthetic RMS admin via ECS one-off (no image rebuild).
 *
 * Usage:
 *   RMS_E2E_COGNITO_SUB=<sub> node scripts/run-ecs-link-rms-cognito.mjs
 */
import { runPlatformApiOneOff } from "./ecs-oneoff.mjs";

const sub = (process.env.RMS_E2E_COGNITO_SUB ?? "").trim();
if (!sub) {
  console.error("RMS_E2E_COGNITO_SUB is required");
  process.exit(1);
}

const adminEmail = (process.env.RMS_E2E_ADMIN_EMAIL ?? "admin@rms-synthetic.test").trim();
const tenantKey = (process.env.RMS_SYNTHETIC_TENANT_KEY ?? "rms-synthetic-fd").trim();

// Import only workspace packages — direct `postgres` imports fail under platform-api node_modules.
const script = `
import { LOCAL_PLACEHOLDER_ENV, loadEnvironmentAsync } from "@forge/environment";
import { and, eq } from "drizzle-orm";
import {
  authenticationIdentities,
  createDatabase,
  createId,
  tenants,
  users,
} from "@forge/database";

const cognitoSub = ${JSON.stringify(sub)};
const adminEmail = ${JSON.stringify(adminEmail)};
const tenantKey = ${JSON.stringify(tenantKey)};

const env = await loadEnvironmentAsync({ ...LOCAL_PLACEHOLDER_ENV, ...process.env });
const db = createDatabase(env.DATABASE_URL);
const now = new Date();

const [tenant] = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.tenantKey, tenantKey)).limit(1);
if (!tenant) throw new Error("tenant missing: " + tenantKey);
const [admin] = await db.select({ id: users.id, primaryEmail: users.primaryEmail }).from(users)
  .where(and(eq(users.tenantId, tenant.id), eq(users.primaryEmail, adminEmail))).limit(1);
if (!admin) throw new Error("admin missing: " + adminEmail);
const [existing] = await db.select().from(authenticationIdentities).where(and(
  eq(authenticationIdentities.provider, "COGNITO"),
  eq(authenticationIdentities.providerSubject, cognitoSub),
)).limit(1);
if (existing) {
  if (existing.userId !== admin.id) throw new Error("sub linked to other user");
  await db.update(authenticationIdentities)
    .set({ lastAuthenticatedAt: now, emailAtLinkTime: admin.primaryEmail })
    .where(eq(authenticationIdentities.id, existing.id));
  console.info(JSON.stringify({ ok: true, created: false, tenantId: tenant.id, userId: admin.id, identityId: existing.id, cognitoSub }));
} else {
  const identityId = createId();
  await db.insert(authenticationIdentities).values({
    id: identityId,
    tenantId: tenant.id,
    userId: admin.id,
    provider: "COGNITO",
    providerSubject: cognitoSub,
    emailAtLinkTime: admin.primaryEmail,
    createdAt: now,
    lastAuthenticatedAt: now,
  });
  console.info(JSON.stringify({ ok: true, created: true, tenantId: tenant.id, userId: admin.id, identityId, cognitoSub }));
}
process.exit(0);
`;

const { cluster, taskArn } = runPlatformApiOneOff(
  ["node", "--input-type=module", "-e", script],
  "link-rms-cognito",
);

console.log("Waiting for task to stop…");
const { spawnSync } = await import("node:child_process");
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
