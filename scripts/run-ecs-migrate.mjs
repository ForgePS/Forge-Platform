#!/usr/bin/env node
/**
 * Run Drizzle migrations via ECS one-off against Aurora.
 * Uses forge_admin (master) secret — never the forge_app runtime secret.
 * Does not print secret values.
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
  throw new Error(`Refusing migrate with non-admin secret ARN: ${adminSecretArn}`);
}

runPlatformApiOneOff(["node", "/app/packages/database/dist/migrate-ecs.js"], "migrate", {
  environment: {
    DATABASE_SECRET_ARN: adminSecretArn,
  },
});
