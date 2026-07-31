#!/usr/bin/env node
/** Seed isolation tenant B via ECS (requires database dist in API image). */
import { runPlatformApiOneOff } from "./ecs-oneoff.mjs";
import { spawnSync } from "node:child_process";

const { cluster, taskArn } = runPlatformApiOneOff(
  ["node", "/app/packages/database/dist/seed-rms-synthetic-b.js"],
  "seed-rms-isolation-tenant",
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
process.exit(parsed.exitCode === 0 ? 0 : 1);
