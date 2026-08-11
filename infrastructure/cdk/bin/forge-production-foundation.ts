#!/usr/bin/env node
/**
 * PROD-S0R foundation-only CDK app.
 * Deploys Network, Security, Observability, Data, Backup — no customer-facing app stacks.
 */
import * as cdk from "aws-cdk-lib";
import { Aspects } from "aws-cdk-lib";
import { resolveConfig } from "../lib/config/environment-config.js";
import { TaggingAspect, createMandatoryTags } from "../lib/aspects/tagging-aspect.js";
import { RemovalPolicyAspect } from "../lib/aspects/removal-policy-aspect.js";
import { NetworkStack } from "../lib/stacks/network-stack.js";
import { SecurityStack } from "../lib/stacks/security-stack.js";
import { DataStack } from "../lib/stacks/data-stack.js";
import { ObservabilityStack } from "../lib/stacks/observability-stack.js";
import { BackupStack } from "../lib/stacks/backup-stack.js";

const app = new cdk.App();
const config = resolveConfig();

if (config.environmentName !== "production" && config.environmentName !== "govcloud-production") {
  throw new Error(
    `forge-production-foundation.ts requires FORGE_ENV=production (got ${config.environmentName})`,
  );
}

const env = {
  account: config.account,
  region: config.region,
};

Aspects.of(app).add(new TaggingAspect(createMandatoryTags(config.environmentName)));
Aspects.of(app).add(new RemovalPolicyAspect(true));

const network = new NetworkStack(app, "ForgeNetwork", { config, env });
const security = new SecurityStack(app, "ForgeSecurity", { config, env });
const observability = new ObservabilityStack(app, "ForgeObservability", {
  config,
  env,
  logsKey: security.logsKey,
});
const data = new DataStack(app, "ForgeData", {
  config,
  env,
  vpc: network.vpc,
  databaseSecurityGroup: network.securityGroups.databaseSg,
  storageKey: security.storageKey,
});
new BackupStack(app, "ForgeBackup", {
  config,
  env,
  backupKey: security.backupKey,
  databaseCluster: data.cluster,
  documentsBucket: data.documentsBucket,
  auditArchiveBucket: data.auditArchiveBucket,
});

data.addStackDependency(network);
data.addStackDependency(security);
observability.addStackDependency(security);

app.synth();
