#!/usr/bin/env node
/**
 * Seed / refresh synthetic FD A (includes specialty flag override).
 * Uses forge_admin for seed writes.
 */
import { awsText, runPlatformApiOneOff } from "./ecs-oneoff.mjs";

const adminSecretName =
  process.env.FORGE_ADMIN_DB_SECRET_NAME || "forge-development-secrets-database";
const adminSecretArn = awsText([
  "secretsmanager",
  "describe-secret",
  "--secret-id",
  adminSecretName,
  "--query",
  "ARN",
]);

runPlatformApiOneOff(["node", "/app/packages/database/dist/seed-rms-synthetic.js"], "seed-rms", {
  environment: { DATABASE_SECRET_ARN: adminSecretArn },
});
