/**
 * Look up platform admin users for branding upload probing.
 */
import { awsText, runPlatformApiOneOff } from "./ecs-oneoff.mjs";
import { spawnSync } from "node:child_process";

const adminSecretArn = awsText([
  "secretsmanager",
  "describe-secret",
  "--secret-id",
  "forge-development-secrets-database",
  "--query",
  "ARN",
]);

const script = `
import { LOCAL_PLACEHOLDER_ENV, loadEnvironmentAsync } from "@forge/environment";
import { sql } from "drizzle-orm";
import { createDatabase } from "@forge/database";
const env = await loadEnvironmentAsync({ ...LOCAL_PLACEHOLDER_ENV, ...process.env });
const db = createDatabase(env.DATABASE_URL);
const rows = await db.execute(sql\`
  select u.id::text as user_id, u.email, u.tenant_id::text as home_tenant, r.code as role_code
  from users u
  join memberships m on m.user_id = u.id and m.tenant_id = u.tenant_id and m.status = 'ACTIVE'
  join membership_roles mr on mr.membership_id = m.id
  join roles r on r.id = mr.role_id
  where r.code = 'PLATFORM_SUPER_ADMIN'
  order by u.email
  limit 20
\`);
console.info(JSON.stringify({ ok: true, admins: rows.rows ?? rows }, null, 2));
process.exit(0);
`;

const { cluster, taskArn } = runPlatformApiOneOff(
  ["node", "--input-type=module", "-e", script],
  "find-psa",
  { environment: { DATABASE_SECRET_ARN: adminSecretArn } },
);
spawnSync("aws", ["ecs", "wait", "tasks-stopped", "--cluster", cluster, "--tasks", taskArn], {
  encoding: "utf8",
  shell: true,
});
const taskId = taskArn.split("/").pop();
const logs = spawnSync(
  "aws",
  [
    "logs",
    "get-log-events",
    "--log-group-name",
    "/forge/development/platform-api",
    "--log-stream-name",
    "platform-api/platform-api/" + taskId,
    "--limit",
    "80",
    "--region",
    "us-east-1",
    "--output",
    "json",
  ],
  { encoding: "utf8", shell: true },
);
const text = (JSON.parse(logs.stdout || "{}").events || []).map((e) => e.message).join("\n");
process.stdout.write(text + (text.endsWith("\n") ? "" : "\n"));
