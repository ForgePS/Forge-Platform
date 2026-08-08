#!/usr/bin/env node
/**
 * Register platform-api TD from base revision with updated image + optional Cognito client append.
 * Usage: node scripts/register-api-td-industrial.mjs <image-tag> <industrial-client-id> [base-revision]
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const tag = process.argv[2];
const industrialClientId = process.argv[3];
const baseRevision = process.argv[4] || "70";
if (!tag || !industrialClientId) {
  console.error(
    "Usage: node scripts/register-api-td-industrial.mjs <image-tag> <industrial-client-id> [base-revision]",
  );
  process.exit(1);
}

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

function slim(td) {
  const out = {};
  for (const k of keep) if (td[k] !== undefined) out[k] = td[k];
  return out;
}

const raw = execFileSync(
  "aws",
  [
    "ecs",
    "describe-task-definition",
    "--task-definition",
    `forge-development-ecs-platform-api:${baseRevision}`,
    "--output",
    "json",
  ],
  { encoding: "utf8" },
);
const td = JSON.parse(raw).taskDefinition;
const prior = td.revision;
for (const c of td.containerDefinitions) {
  if (c.name !== "platform-api") continue;
  c.image = apiImage;
  for (const env of c.environment ?? []) {
    if (env.name === "COGNITO_CLIENT_ID") {
      const parts = String(env.value)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (!parts.includes(industrialClientId)) parts.push(industrialClientId);
      env.value = parts.join(",");
    }
    if (env.name === "CORS_ORIGINS") {
      const origin = "https://industrial-dev.forgepublicsafety.com";
      const parts = String(env.value)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (!parts.includes(origin)) parts.push(origin);
      env.value = parts.join(",");
    }
  }
}
const payloadPath = ".forge-td-api-industrial.json";
fs.writeFileSync(payloadPath, JSON.stringify(slim(td), null, 2));
const reg = JSON.parse(
  execFileSync(
    "aws",
    ["ecs", "register-task-definition", "--cli-input-json", `file://${payloadPath}`, "--output", "json"],
    { encoding: "utf8" },
  ),
).taskDefinition;

const result = {
  priorRevision: prior,
  arn: reg.taskDefinitionArn,
  revision: reg.revision,
  image: reg.containerDefinitions.find((c) => c.name === "platform-api")?.image,
  tag,
  industrialClientId,
};
console.log(JSON.stringify(result, null, 2));

execFileSync(
  "aws",
  [
    "ecs",
    "update-service",
    "--cluster",
    "forge-development-ecs-platform",
    "--service",
    "forge-development-ecs-platform-api",
    "--task-definition",
    `forge-development-ecs-platform-api:${reg.revision}`,
    "--force-new-deployment",
    "--output",
    "json",
  ],
  { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
);
console.log(
  JSON.stringify({
    updatedService: "forge-development-ecs-platform-api",
    taskDefinition: `forge-development-ecs-platform-api:${reg.revision}`,
  }),
);
