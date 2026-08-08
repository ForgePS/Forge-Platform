/**
 * Inspect drizzle migration history + whether 0028 SQL is in the ECS image.
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
import { readdirSync, existsSync, readFileSync } from "node:fs";
const env = await loadEnvironmentAsync({ ...LOCAL_PLACEHOLDER_ENV, ...process.env });
const db = createDatabase(env.DATABASE_URL);
const migrations = await db.execute(sql\`
  select id, hash, created_at
  from drizzle.__drizzle_migrations
  order by created_at desc
  limit 12
\`);
const drizzleDir = "/app/packages/database/drizzle";
const files = existsSync(drizzleDir)
  ? readdirSync(drizzleDir).filter((f) => f.endsWith(".sql")).sort()
  : [];
const has0028 = files.includes("0028_industrial_ops_records.sql");
const table = await db.execute(sql\`
  select to_regclass('public.industrial_ops_records')::text as table_name
\`);
console.info(JSON.stringify({
  ok: true,
  table: table.rows ?? table,
  recentMigrations: migrations.rows ?? migrations,
  sqlFiles: files.slice(-8),
  has0028,
  journalTail: existsSync(drizzleDir + "/meta/_journal.json")
    ? JSON.parse(readFileSync(drizzleDir + "/meta/_journal.json", "utf8")).entries.slice(-5)
    : null,
}, null, 2));
process.exit(0);
`;

const { cluster, taskArn } = runPlatformApiOneOff(
  ["node", "--input-type=module", "-e", script],
  "check-mig-state",
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
