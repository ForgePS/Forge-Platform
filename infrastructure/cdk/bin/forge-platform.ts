#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { Aspects } from "aws-cdk-lib";
import { resolveConfig } from "../lib/config/environment-config.js";
import { TaggingAspect, createMandatoryTags } from "../lib/aspects/tagging-aspect.js";
import { RemovalPolicyAspect } from "../lib/aspects/removal-policy-aspect.js";
import { NetworkStack } from "../lib/stacks/network-stack.js";
import { SecurityStack } from "../lib/stacks/security-stack.js";
import { DataStack } from "../lib/stacks/data-stack.js";
import { IdentityStack } from "../lib/stacks/identity-stack.js";
import { MessagingStack } from "../lib/stacks/messaging-stack.js";
import { ObservabilityStack, MonitoringStack } from "../lib/stacks/observability-stack.js";
import { ComputeStack } from "../lib/stacks/compute-stack.js";
import { FrontendStack } from "../lib/stacks/frontend-stack.js";
import { BackupStack } from "../lib/stacks/backup-stack.js";
import { AuditStack } from "../lib/stacks/audit-stack.js";

const app = new cdk.App();
const config = resolveConfig();

const env = {
  account: config.account,
  region: config.region,
};

Aspects.of(app).add(new TaggingAspect(createMandatoryTags(config.environmentName)));
Aspects.of(app).add(
  new RemovalPolicyAspect(
    config.environmentName.includes("production") || config.environmentName.startsWith("govcloud"),
  ),
);

const network = new NetworkStack(app, "ForgeNetwork", { config, env });
const security = new SecurityStack(app, "ForgeSecurity", { config, env });
const identity = new IdentityStack(app, "ForgeIdentity", { config, env });

const messaging = new MessagingStack(app, "ForgeMessaging", {
  config,
  env,
  encryptionKey: security.generalKey,
});

const data = new DataStack(app, "ForgeData", {
  config,
  env,
  vpc: network.vpc,
  databaseSecurityGroup: network.securityGroups.databaseSg,
  storageKey: security.storageKey,
});

const observability = new ObservabilityStack(app, "ForgeObservability", {
  config,
  env,
  logsKey: security.logsKey,
});

const publicRmsUrl = "https://d3ud5uzwd9js2z.cloudfront.net";
const publicCreatorUrl = "https://ddztl9s33wu40.cloudfront.net";
const publicTenantAdminUrl = "https://d1uxdl4szvsixc.cloudfront.net";
const publicIndustrialUrl = "https://industrial-dev.forgepublicsafety.com";
const cognitoDomain = `forge-${config.environmentName}-${config.account.slice(-6)}.auth.${config.region}.amazoncognito.com`;

const compute = new ComputeStack(app, "ForgeCompute", {
  config,
  env,
  vpc: network.vpc,
  albSecurityGroup: network.securityGroups.albSg,
  apiSecurityGroup: network.securityGroups.ecsApiSg,
  workerSecurityGroup: network.securityGroups.workerSg,
  databaseSecret: data.database.secret,
  // GAP-009 Strategy A: Data + Compute both reference forge-*-secrets-database-app
  // by name when importExistingAppSecret=true. Do not pass a created AppDbSecret
  // export (would recreate AlreadyExists). Secret value/ARN remain external.
  importQueue: messaging.imports,
  notificationQueue: messaging.notifications,
  documentQueue: messaging.documents,
  integrationQueue: messaging.integrationEvents,
  cadIntakeQueue: messaging.cadIntake,
  cadNormalizationQueue: messaging.cadNormalization,
  cadMatchingQueue: messaging.cadMatching,
  cadApplicationQueue: messaging.cadApplication,
  cadPollingQueue: messaging.cadPolling,
  cadRetentionQueue: messaging.cadRetention,
  eventBus: messaging.eventBus,
  documentsBucket: data.documentsBucket,
  importsBucket: data.importsBucket,
  exportsBucket: data.exportsBucket,
  apiLogGroup: observability.apiLogGroup,
  workerLogGroup: observability.workerLogGroup,
  cognitoUserPoolId: identity.userPool.userPoolId,
  cognitoClientIds: [
    identity.cognito.rmsClient.userPoolClientId,
    identity.cognito.creatorClient.userPoolClientId,
    identity.cognito.industrialClient.userPoolClientId,
  ].join(","),
  cognitoDomain,
  // S8 DEF-S8-021: Tenant Admin must call API from browser with X-Forge-Dev-Principal.
  browserOrigins: [
    publicRmsUrl,
    publicCreatorUrl,
    publicTenantAdminUrl,
    publicIndustrialUrl,
    "https://creator-dev.forgepublicsafety.com",
    "https://admin-dev.forgepublicsafety.com",
    "https://rms-dev.forgepublicsafety.com",
    "https://industrial-dev.forgepublicsafety.com",
    "https://producers-rice-mill.forgepublicsafety.com",
  ],
  publicRmsUrl,
  publicCreatorUrl,
});

new MonitoringStack(app, "ForgeMonitoring", {
  config,
  env,
  apiService: compute.apiService,
  workerService: compute.workerService,
  alb: compute.alb,
  apiTargetGroup: compute.apiTargetGroup,
  databaseCluster: data.cluster,
  importsQueue: messaging.imports,
  importsDlq: messaging.importsDlq,
  notificationsDlq: messaging.notificationsDlq,
  documentsDlq: messaging.documentsDlq,
  integrationDlq: messaging.integrationEventsDlq,
  cadIntakeDlq: messaging.cadIntakeDlq,
  cadNormalizationDlq: messaging.cadNormalizationDlq,
  cadMatchingDlq: messaging.cadMatchingDlq,
  cadApplicationDlq: messaging.cadApplicationDlq,
  cadPollingDlq: messaging.cadPollingDlq,
  cadRetentionDlq: messaging.cadRetentionDlq,
  apiCloudFrontDistributionId: compute.ecs.apiHttps.distribution.distributionId,
  rmsCloudFrontDistributionId: "E2LZJLH664YX70",
});

new BackupStack(app, "ForgeBackup", {
  config,
  env,
  backupKey: security.backupKey,
  databaseCluster: data.cluster,
  documentsBucket: data.documentsBucket,
  auditArchiveBucket: data.auditArchiveBucket,
});

const audit = config.features.enableCloudTrail
  ? new AuditStack(app, "ForgeAudit", {
      config,
      env,
      storageKey: security.storageKey,
      logsKey: security.logsKey,
      // Targeted WriteOnly data events for high-value buckets only (cost/volume reviewed).
      dataEventBuckets: [data.documentsBucket, data.exportsBucket, data.auditArchiveBucket],
    })
  : undefined;

new FrontendStack(app, "ForgeFrontend", { config, env });

data.addStackDependency(network);
data.addStackDependency(security);
messaging.addStackDependency(security);
observability.addStackDependency(security);
compute.addStackDependency(network);
compute.addStackDependency(data);
compute.addStackDependency(messaging);
compute.addStackDependency(observability);
compute.addStackDependency(identity);
if (audit) {
  audit.addStackDependency(security);
  audit.addStackDependency(data);
}

app.synth();
