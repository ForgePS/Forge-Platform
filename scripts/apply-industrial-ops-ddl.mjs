/**
 * Apply industrial_ops_records DDL directly (admin). Idempotent IF NOT EXISTS.
 * Use when journal marks 0028 applied but the table is missing.
 */
import { awsText, runPlatformApiOneOff } from "./ecs-oneoff.mjs";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const adminSecretArn = awsText([
  "secretsmanager",
  "describe-secret",
  "--secret-id",
  "forge-development-secrets-database",
  "--query",
  "ARN",
]);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqlPath = path.join(
  __dirname,
  "..",
  "packages",
  "database",
  "drizzle",
  "0028_industrial_ops_records.sql",
);
const ddl = readFileSync(sqlPath, "utf8");

const script = `
import { LOCAL_PLACEHOLDER_ENV, loadEnvironmentAsync } from "@forge/environment";
import { sql } from "drizzle-orm";
import { createDatabase } from "@forge/database";
const env = await loadEnvironmentAsync({ ...LOCAL_PLACEHOLDER_ENV, ...process.env });
const db = createDatabase(env.DATABASE_URL);
const before = await db.execute(sql\`select to_regclass('public.industrial_ops_records')::text as table_name\`);
const ddl = ${JSON.stringify(ddl)};
await db.execute(sql.raw(ddl));
const after = await db.execute(sql\`select to_regclass('public.industrial_ops_records')::text as table_name\`);
const grants = await db.execute(sql\`
  select grantee, privilege_type
  from information_schema.role_table_grants
  where table_schema = 'public' and table_name = 'industrial_ops_records'
  order by grantee, privilege_type
\`);
const policies = await db.execute(sql\`
  select polname::text, polcmd::text
  from pg_policy
  where polrelid = 'public.industrial_ops_records'::regclass
\`);
console.info(JSON.stringify({
  ok: true,
  before: before.rows ?? before,
  after: after.rows ?? after,
  grants: grants.rows ?? grants,
  policies: policies.rows ?? policies,
}, null, 2));
process.exit(0);
`;

const { cluster, taskArn } = runPlatformApiOneOff(
  ["node", "--input-type=module", "-e", script],
  "apply-ops-ddl",
  { environment: { DATABASE_SECRET_ARN: adminSecretArn } },
);
spawnSync("aws", ["ecs", "wait", "tasks-stopped", "--cluster", cluster, "--tasks", taskArn], {
  encoding: "utf8",
  shell: true,
});
const taskId = taskArn.split("/").pop();
const desc = spawnSync(
  "aws",
  [
    "ecs",
    "describe-tasks",
    "--cluster",
    cluster,
    "--tasks",
    taskArn,
    "--region",
    "us-east-1",
    "--query",
    "tasks[0].containers[0].exitCode",
    "--output",
    "text",
  ],
  { encoding: "utf8", shell: true },
);
process.stdout.write("exitCode " + String(desc.stdout || "").trim() + "\n");
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
    "100",
    "--region",
    "us-east-1",
    "--output",
    "json",
  ],
  { encoding: "utf8", shell: true },
);
const text = (JSON.parse(logs.stdout || "{}").events || []).map((e) => e.message).join("\n");
process.stdout.write(text + (text.endsWith("\n") ? "" : "\n"));
