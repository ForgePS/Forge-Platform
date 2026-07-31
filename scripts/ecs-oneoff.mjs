#!/usr/bin/env node
/**
 * Shared helper: run a one-off Fargate task with container command overrides.
 * Windows-safe: writes overrides JSON next to CWD and passes file://relative.
 */
import { spawnSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";

export function awsJson(args) {
  const result = spawnSync("aws", [...args, "--output", "json"], {
    encoding: "utf8",
    shell: true,
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "aws command failed");
  }
  return JSON.parse(result.stdout);
}

export function awsText(args) {
  const result = spawnSync("aws", [...args, "--output", "text"], {
    encoding: "utf8",
    shell: true,
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "aws command failed");
  }
  return result.stdout.trim();
}

export function runPlatformApiOneOff(command, label, options = {}) {
  const cluster = awsText([
    "cloudformation",
    "describe-stacks",
    "--stack-name",
    "Forge-Development-Compute",
    "--query",
    "Stacks[0].Outputs[?OutputKey=='ForgeComputeClusterName'].OutputValue",
  ]);

  const service = "forge-development-ecs-platform-api";
  const desc = awsJson(["ecs", "describe-services", "--cluster", cluster, "--services", service]);
  const serviceObj = desc.services?.[0];
  if (!serviceObj) throw new Error("platform-api service not found");

  const taskDef = serviceObj.taskDefinition;
  const subnets = serviceObj.networkConfiguration.awsvpcConfiguration.subnets;
  const securityGroups = serviceObj.networkConfiguration.awsvpcConfiguration.securityGroups;

  const containerOverride = {
    name: "platform-api",
    command,
  };
  if (options.environment && typeof options.environment === "object") {
    containerOverride.environment = Object.entries(options.environment).map(([name, value]) => ({
      name,
      value: String(value),
    }));
  }

  const fileName = `.forge-ecs-overrides-${Date.now()}.json`;
  const overridesPath = join(process.cwd(), fileName);
  writeFileSync(
    overridesPath,
    JSON.stringify({
      containerOverrides: [containerOverride],
    }),
  );

  console.log(
    JSON.stringify(
      {
        cluster,
        taskDef,
        subnets,
        securityGroups,
        action: `starting ${label}`,
        environmentOverrides: containerOverride.environment?.map((e) => e.name) ?? [],
      },
      null,
      2,
    ),
  );

  try {
    const run = awsJson([
      "ecs",
      "run-task",
      "--cluster",
      cluster,
      "--launch-type",
      "FARGATE",
      "--task-definition",
      taskDef,
      "--network-configuration",
      `awsvpcConfiguration={subnets=[${subnets.join(",")}],securityGroups=[${securityGroups.join(",")}],assignPublicIp=DISABLED}`,
      "--overrides",
      `file://${fileName}`,
    ]);

    const taskArn = run.tasks?.[0]?.taskArn;
    if (!taskArn) {
      console.error(JSON.stringify(run, null, 2));
      throw new Error(`Failed to start ${label} task`);
    }

    console.log(JSON.stringify({ taskArn, status: "started", label }, null, 2));
    console.log("Wait with: aws ecs wait tasks-stopped --cluster", cluster, "--tasks", taskArn);
    return { cluster, taskArn };
  } finally {
    try {
      unlinkSync(overridesPath);
    } catch {
      /* ignore */
    }
  }
}
