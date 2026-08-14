#!/usr/bin/env node
/**
 * Register a new production platform-api task definition with an updated image tag.
 * Usage: node scripts/register-api-td-production.mjs <image-tag> [base-revision]
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const tag = process.argv[2];
const baseRevision = process.argv[3] || "17";
if (!tag) {
  console.error("Usage: node scripts/register-api-td-production.mjs <image-tag> [base-revision]");
  process.exit(1);
}

const apiImage = `511343547817.dkr.ecr.us-east-1.amazonaws.com/forge-production-ecr-platformapi:${tag}`;
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
    `forge-production-ecs-platform-api:${baseRevision}`,
    "--output",
    "json",
  ],
  { encoding: "utf8" },
);
const td = JSON.parse(raw).taskDefinition;
const prior = td.revision;
for (const c of td.containerDefinitions) {
  if (c.name === "platform-api") c.image = apiImage;
}
const payloadPath = ".forge-td-api-register-production.json";
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
  image:
    reg.containerDefinitions.find((c) => c.name === "platform-api")?.image ??
    reg.containerDefinitions[0].image,
  tag,
};
console.log(JSON.stringify(result, null, 2));
