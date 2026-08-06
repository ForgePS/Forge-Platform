#!/usr/bin/env node
/**
 * Build a static-export Forge app, sync to S3, and invalidate CloudFront.
 *
 * Usage:
 *   node scripts/sync-static-site.mjs --app console
 *   node scripts/sync-static-site.mjs --app rms
 *   node scripts/sync-static-site.mjs --app rms --skip-build
 *
 * Environment (optional — resolved from CloudFormation exports when omitted):
 *   FORGE_ENVIRONMENT          default: development
 *   FORGE_{APP}_BUCKET         S3 bucket name
 *   FORGE_{APP}_DISTRIBUTION_ID CloudFront distribution ID
 *   AWS_PROFILE / AWS_REGION
 *
 * Build env (resolved when not already set):
 *   NEXT_PUBLIC_API_URL        prefer development canonical, else ForgeCompute-ApiHttpsDomain
 *   NEXT_PUBLIC_APP_URL        prefer development canonical host for the app, else Frontend export
 *   NEXT_PUBLIC_COGNITO_DOMAIN from ForgeIdentity-CognitoDomain or FORGE_COGNITO_DOMAIN
 *   NEXT_PUBLIC_COGNITO_USER_POOL_ID from ForgeIdentity-UserPoolId
 *   NEXT_PUBLIC_COGNITO_CLIENT_ID
 *     rms         → ForgeIdentity-RmsClientId
 *     console     → ForgeIdentity-CreatorClientId
 *     tenantadmin → ForgeIdentity-CreatorClientId (shared Creator client until a TA client exists)
 *
 * Deployed builds must NOT set NEXT_PUBLIC_ALLOW_DEV_PRINCIPAL.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..");

const APPS = {
  console: {
    packageName: "@forge/creator-console",
    outDir: "apps/creator-console/out",
    stackExportPrefix: "ForgeFrontend-Console",
  },
  rms: {
    packageName: "@forge/rms-web",
    outDir: "apps/rms-web/out",
    stackExportPrefix: "ForgeFrontend-Rms",
  },
  tenantadmin: {
    packageName: "@forge/tenant-admin",
    outDir: "apps/tenant-admin/out",
    stackExportPrefix: "ForgeFrontend-TenantAdmin",
  },
};

function parseArgs(argv) {
  let app = null;
  let skipBuild = false;
  let environment = process.env.FORGE_ENVIRONMENT || "development";

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--app") {
      app = argv[i + 1];
      i += 1;
    } else if (arg === "--environment") {
      environment = argv[i + 1];
      i += 1;
    } else if (arg === "--skip-build") {
      skipBuild = true;
    } else if (arg === "--help" || arg === "-h") {
      console.log(
        `Usage: node scripts/sync-static-site.mjs --app console|rms|tenantadmin [--environment development] [--skip-build]`,
      );
      process.exit(0);
    }
  }

  if (!app || !APPS[app]) {
    console.error("Required: --app console|rms|tenantadmin");
    process.exit(1);
  }

  return { app, skipBuild, environment };
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    ...options,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function resolveExport(exportName) {
  // Prefer shell:false so JMESPath single quotes are not mangled by cmd.exe on Windows.
  const result = spawnSync(
    "aws",
    [
      "cloudformation",
      "list-exports",
      "--query",
      `Exports[?Name==\`${exportName}\`].Value | [0]`,
      "--output",
      "text",
    ],
    { encoding: "utf8", env: process.env, shell: false },
  );
  if (result.status !== 0) {
    console.error(`Failed to resolve CloudFormation export ${exportName}`);
    if (result.stderr) console.error(result.stderr);
    process.exit(result.status ?? 1);
  }
  // AWS CLI on Windows can append a trailing "None" line / CR; keep the first token only.
  const value = (result.stdout || "")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0 && line !== "None");
  if (!value) {
    return null;
  }
  return value;
}

function envKeyForApp(app, suffix) {
  return `FORGE_${app.toUpperCase()}_${suffix}`;
}

function toHttpsOrigin(domain) {
  if (!domain) return null;
  const cleaned = domain.replace(/\r/g, "").split("\n")[0]?.trim() ?? "";
  if (!cleaned || cleaned === "None") return null;
  if (cleaned.startsWith("http://") || cleaned.startsWith("https://")) {
    return cleaned.replace(/\/$/, "");
  }
  return `https://${cleaned.replace(/\/$/, "")}`;
}

/** Development CNAMEs that front CloudFront (match live Route 53 + Cognito allowlists). */
const DEVELOPMENT_CANONICAL = {
  api: "https://api-dev.forgepublicsafety.com",
  console: "https://creator-dev.forgepublicsafety.com",
  rms: "https://rms-dev.forgepublicsafety.com",
  tenantadmin: "https://admin-dev.forgepublicsafety.com",
};

function resolveApiBuildUrl(environment, buildEnv) {
  if (buildEnv.NEXT_PUBLIC_API_URL) return;
  if (environment === "development") {
    buildEnv.NEXT_PUBLIC_API_URL = DEVELOPMENT_CANONICAL.api;
    console.log(`Resolved NEXT_PUBLIC_API_URL=${buildEnv.NEXT_PUBLIC_API_URL} (canonical)`);
    return;
  }
  const apiDomain =
    resolveExport("ForgeCompute-ApiHttpsDomain") ?? process.env.FORGE_API_HTTPS_DOMAIN;
  const apiUrl = toHttpsOrigin(apiDomain);
  if (apiUrl) {
    buildEnv.NEXT_PUBLIC_API_URL = apiUrl;
    console.log(`Resolved NEXT_PUBLIC_API_URL=${apiUrl}`);
  } else {
    console.warn(
      "Missing NEXT_PUBLIC_API_URL — set it or export ForgeCompute-ApiHttpsDomain from the Compute stack.",
    );
  }
}

function resolveAppBuildUrl(environment, buildEnv, { appKey, exportName, envFallback }) {
  if (buildEnv.NEXT_PUBLIC_APP_URL) return;
  if (environment === "development" && DEVELOPMENT_CANONICAL[appKey]) {
    buildEnv.NEXT_PUBLIC_APP_URL = DEVELOPMENT_CANONICAL[appKey];
    console.log(`Resolved NEXT_PUBLIC_APP_URL=${buildEnv.NEXT_PUBLIC_APP_URL} (canonical)`);
    return;
  }
  const appDomain = resolveExport(exportName) ?? process.env[envFallback];
  const appUrl = toHttpsOrigin(appDomain);
  if (appUrl) {
    buildEnv.NEXT_PUBLIC_APP_URL = appUrl;
    console.log(`Resolved NEXT_PUBLIC_APP_URL=${appUrl}`);
  } else {
    console.warn(
      `Missing NEXT_PUBLIC_APP_URL — set it or export ${exportName} from the Frontend stack.`,
    );
  }
}

function resolveSharedCognitoBuildEnv(buildEnv) {
  if (!buildEnv.NEXT_PUBLIC_COGNITO_USER_POOL_ID) {
    const poolId =
      resolveExport("ForgeIdentity-UserPoolId") ?? process.env.FORGE_COGNITO_USER_POOL_ID;
    if (poolId) {
      buildEnv.NEXT_PUBLIC_COGNITO_USER_POOL_ID = poolId;
      console.log(`Resolved NEXT_PUBLIC_COGNITO_USER_POOL_ID=${poolId}`);
    }
  }

  if (!buildEnv.NEXT_PUBLIC_COGNITO_DOMAIN) {
    const domain = resolveExport("ForgeIdentity-CognitoDomain") ?? process.env.FORGE_COGNITO_DOMAIN;
    if (domain) {
      buildEnv.NEXT_PUBLIC_COGNITO_DOMAIN = domain;
      console.log(`Resolved NEXT_PUBLIC_COGNITO_DOMAIN=${domain}`);
    } else {
      console.warn(
        "Missing NEXT_PUBLIC_COGNITO_DOMAIN — set FORGE_COGNITO_DOMAIN (forge-{env}-{accountLast6}.auth.{region}.amazoncognito.com).",
      );
    }
  }
}

function resolveCognitoClientId(buildEnv, { exportName, envFallback, label }) {
  if (buildEnv.NEXT_PUBLIC_COGNITO_CLIENT_ID) return;
  const clientId = resolveExport(exportName) ?? process.env[envFallback];
  if (clientId) {
    buildEnv.NEXT_PUBLIC_COGNITO_CLIENT_ID = clientId;
    console.log(`Resolved NEXT_PUBLIC_COGNITO_CLIENT_ID=${clientId}`);
  } else {
    console.warn(
      `Missing NEXT_PUBLIC_COGNITO_CLIENT_ID — ${exportName} export is not deployed yet; set ${envFallback} (${label}).`,
    );
  }
}

function resolveRmsBuildEnv(environment) {
  const buildEnv = { ...process.env };
  resolveApiBuildUrl(environment, buildEnv);
  resolveAppBuildUrl(environment, buildEnv, {
    appKey: "rms",
    exportName: "ForgeFrontend-RmsDomain",
    envFallback: "FORGE_RMS_APP_DOMAIN",
  });
  resolveSharedCognitoBuildEnv(buildEnv);
  resolveCognitoClientId(buildEnv, {
    exportName: "ForgeIdentity-RmsClientId",
    envFallback: "FORGE_RMS_COGNITO_CLIENT_ID",
    label: "RMS web",
  });
  delete buildEnv.NEXT_PUBLIC_ALLOW_DEV_PRINCIPAL;
  return buildEnv;
}

function resolveTenantAdminBuildEnv(environment) {
  const buildEnv = { ...process.env };
  resolveApiBuildUrl(environment, buildEnv);
  resolveAppBuildUrl(environment, buildEnv, {
    appKey: "tenantadmin",
    exportName: "ForgeFrontend-TenantAdminDomain",
    envFallback: "FORGE_TENANTADMIN_APP_DOMAIN",
  });
  resolveSharedCognitoBuildEnv(buildEnv);
  resolveCognitoClientId(buildEnv, {
    exportName: "ForgeIdentity-CreatorClientId",
    envFallback: "FORGE_CONSOLE_COGNITO_CLIENT_ID",
    label: "Creator / Tenant Admin shared client",
  });
  delete buildEnv.NEXT_PUBLIC_ALLOW_DEV_PRINCIPAL;
  return buildEnv;
}

/** Creator Console must bake live API + Cognito; localhost defaults break Hosted UI / Import Center. */
function resolveConsoleBuildEnv(environment) {
  const buildEnv = { ...process.env };
  resolveApiBuildUrl(environment, buildEnv);
  resolveAppBuildUrl(environment, buildEnv, {
    appKey: "console",
    exportName: "ForgeFrontend-ConsoleDomain",
    envFallback: "FORGE_CONSOLE_APP_DOMAIN",
  });
  resolveSharedCognitoBuildEnv(buildEnv);
  resolveCognitoClientId(buildEnv, {
    exportName: "ForgeIdentity-CreatorClientId",
    envFallback: "FORGE_CONSOLE_COGNITO_CLIENT_ID",
    label: "Creator Console",
  });
  // Development browser E2E uses forge-dev-principal from localStorage (no ALLOW flag required).
  delete buildEnv.NEXT_PUBLIC_ALLOW_DEV_PRINCIPAL;
  return buildEnv;
}

const { app, skipBuild, environment } = parseArgs(process.argv.slice(2));
const appConfig = APPS[app];
const outPath = path.join(repoRoot, appConfig.outDir);

if (!skipBuild) {
  console.log(`Building ${appConfig.packageName}…`);
  const buildEnv =
    app === "rms"
      ? resolveRmsBuildEnv(environment)
      : app === "tenantadmin"
        ? resolveTenantAdminBuildEnv(environment)
        : app === "console"
          ? resolveConsoleBuildEnv(environment)
          : { ...process.env };
  run("pnpm", ["--filter", appConfig.packageName, "build"], {
    cwd: repoRoot,
    env: buildEnv,
  });
}

if (!existsSync(outPath)) {
  console.error(`Build output not found: ${outPath}`);
  process.exit(1);
}

const bucket =
  process.env[envKeyForApp(app, "BUCKET")] ?? resolveExport(`${appConfig.stackExportPrefix}Bucket`);
const distributionId =
  process.env[envKeyForApp(app, "DISTRIBUTION_ID")] ??
  resolveExport(`${appConfig.stackExportPrefix}DistributionId`);

if (!bucket) {
  console.error(
    `Set ${envKeyForApp(app, "BUCKET")} or deploy ForgeFrontend with enable${app === "console" ? "Console" : "Rms"}Hosting for ${environment}.`,
  );
  process.exit(1);
}

console.log(`Syncing ${outPath} → s3://${bucket}/`);
run("aws", ["s3", "sync", outPath, `s3://${bucket}/`, "--delete"]);

if (distributionId) {
  console.log(`Invalidating CloudFront distribution ${distributionId}…`);
  // shell:false avoids PowerShell globbing/eating of `/*`.
  const invalidation = spawnSync(
    "aws",
    ["cloudfront", "create-invalidation", "--distribution-id", distributionId, "--paths", "/*"],
    { encoding: "utf8", env: process.env, shell: false, stdio: "inherit" },
  );
  if (invalidation.status !== 0) {
    process.exit(invalidation.status ?? 1);
  }
} else {
  console.warn(
    `No distribution ID found (${envKeyForApp(app, "DISTRIBUTION_ID")} or ${appConfig.stackExportPrefix}DistributionId). Skipping invalidation.`,
  );
}

console.log(`Static sync complete for ${app}.`);
