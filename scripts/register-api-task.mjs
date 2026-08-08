#!/usr/bin/env node
/**
 * Register a new platform-api task definition revision with an updated image
 * and optional CORS_ORIGINS env merge, then force a new ECS deployment.
 *
 * Usage:
 *   node scripts/register-api-task.mjs --tag login-branding-20260808
 *   node scripts/register-api-task.mjs --tag login-branding-20260808 --add-cors-origin https://producers-rice-mill.forgepublicsafety.com
 */
import { execSync } from "node:child_process";
import fs from "node:fs";

function parseArgs(argv) {
  let tag = null;
  const addCors = [];
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--tag") {
      tag = argv[++i];
    } else if (a === "--add-cors-origin") {
      addCors.push(argv[++i]);
    }
  }
  if (!tag) {
    throw new Error("Required: --tag <imageTag>");
  }
  return { tag, addCors };
}

const { tag, addCors } = parseArgs(process.argv.slice(2));
const apiImage = `511343547817.dkr.ecr.us-east-1.amazonaws.com/forge-development-ecr-platformapi:${tag}`;
const keep = [
  "family",
  "taskRoleArn",
  "executionRoleArn",
  "networkMode",
  "containerDefinitions",
  "requiresCompatibilities",
  "cpu",
  "memory",
  "volumes",
  "placementConstraints",
  "runtimePlatform",
  "proxyConfiguration",
  "ephemeralStorage",
];

const raw = execSync(
  "aws ecs describe-task-definition --task-definition forge-development-ecs-platform-api --output json",
  { encoding: "utf8" },
);
const td = JSON.parse(raw).taskDefinition;
const prior = td.revision;
td.containerDefinitions[0].image = apiImage;

if (addCors.length > 0) {
  const env = td.containerDefinitions[0].environment ?? [];
  const idx = env.findIndex((e) => e.name === "CORS_ORIGINS");
  const existing = idx >= 0 ? String(env[idx].value || "") : "";
  const set = new Set(
    existing
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
  for (const origin of addCors) set.add(origin);
  const next = [...set].join(",");
  if (idx >= 0) env[idx].value = next;
  else env.push({ name: "CORS_ORIGINS", value: next });
  td.containerDefinitions[0].environment = env;
}

const slim = {};
for (const k of keep) if (td[k] !== undefined) slim[k] = td[k];
fs.writeFileSync(".tmp-td-api.json", JSON.stringify(slim, null, 2));

const reg = JSON.parse(
  execSync("aws ecs register-task-definition --cli-input-json file://.tmp-td-api.json --output json", {
    encoding: "utf8",
  }),
);
const revision = reg.taskDefinition.revision;
const family = reg.taskDefinition.family;
console.log(JSON.stringify({ prior, revision, family, image: apiImage }, null, 2));

execSync(
  `aws ecs update-service --cluster forge-development-ecs-platform --service forge-development-ecs-platform-api --task-definition ${family}:${revision} --force-new-deployment --output text`,
  { stdio: "inherit" },
);
console.log(JSON.stringify({ status: "deployment-started", taskDefinition: `${family}:${revision}` }));
