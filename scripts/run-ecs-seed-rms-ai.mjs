#!/usr/bin/env node
/**
 * Seed / refresh AI Narrative acceptance synthetic FD.
 * Uses forge_admin for seed writes. Does not enable AI globally.
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

runPlatformApiOneOff(
  ["node", "/app/packages/database/dist/seed-rms-ai-synthetic.js"],
  "seed-rms-ai",
  {
    environment: { DATABASE_SECRET_ARN: adminSecretArn },
  },
);
