#!/usr/bin/env node
/**
 * Upsert platform seed catalog (permissions, products, industrial feature flags).
 * Runs via ECS against Aurora using the admin DB secret (ARN only; no secret values printed).
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

if (!adminSecretArn.includes("secrets-database") || adminSecretArn.includes("database-app")) {
  throw new Error(`Refusing seed with non-admin secret ARN: ${adminSecretArn}`);
}

runPlatformApiOneOff(["node", "/app/packages/database/dist/seed.js"], "seed-platform-catalog", {
  environment: {
    DATABASE_SECRET_ARN: adminSecretArn,
  },
});
