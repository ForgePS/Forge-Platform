/**
 * Probe industrial ops list + table existence.
 */
import { awsText, runPlatformApiOneOff } from "./ecs-oneoff.mjs";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

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
const table = await db.execute(sql\`
  select to_regclass('public.industrial_ops_records')::text as table_name
\`);
const grants = await db.execute(sql\`
  select grantee, privilege_type
  from information_schema.role_table_grants
  where table_name = 'industrial_ops_records'
\`).catch((e) => ({ rows: [{ error: String(e.message||e) }] }));
const policies = await db.execute(sql\`
  select polname::text, polcmd::text
  from pg_policy
  where polrelid = 'public.industrial_ops_records'::regclass
\`).catch((e) => ({ rows: [{ error: String(e.message||e) }] }));
console.info(JSON.stringify({
  ok: true,
  table: table.rows ?? table,
  grants: grants.rows ?? grants,
  policies: policies.rows ?? policies,
}, null, 2));
process.exit(0);
`;

const { cluster, taskArn } = runPlatformApiOneOff(
  ["node", "--input-type=module", "-e", script],
  "check-ops-table",
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

// Live HTTP probe as staging admin
const principal = JSON.stringify({
  userId: "0a46dd93-4ecf-4c91-9fad-70d24cee3308",
  tenantId: "0882c865-59c2-49a6-ab88-ce6ca89be30c",
});
const out = process.env.TEMP + "/ops-probe.json";
const curl = spawnSync(
  "curl.exe",
  [
    "-sS",
    "https://api-dev.forgepublicsafety.com/api/v1/industrial/inspections?page=1&pageSize=25",
    "-H",
    "Accept: application/json",
    "-H",
    `x-forge-dev-principal: ${principal}`,
    "-o",
    out,
  ],
  { encoding: "utf8" },
);
console.log("curl_status", curl.status);
console.log(readFileSync(out, "utf8"));
