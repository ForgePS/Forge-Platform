import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import type { ForgeEnvironmentConfig } from "../config/environment-schema.js";
import { ForgeBudgets } from "../constructs/forge-budgets.js";
import { ForgeConsoleHosting } from "../constructs/forge-console-hosting.js";
import { ForgeIndustrialHosting } from "../constructs/forge-industrial-hosting.js";
import { ForgeRmsHosting } from "../constructs/forge-rms-hosting.js";
import { ForgeTenantAdminHosting } from "../constructs/forge-tenant-admin-hosting.js";
import { stackName } from "../utils/naming.js";
import { exportValue } from "../utils/outputs.js";

export interface FrontendStackProps extends cdk.StackProps {
  config: ForgeEnvironmentConfig;
}

/**
 * Static frontends (Creator Console, RMS Web, Tenant Admin, Industrial) and environment cost budgets.
 * Kept separate from Compute so UI deploys do not recycle the API service.
 */
export class FrontendStack extends cdk.Stack {
  readonly console?: ForgeConsoleHosting;
  readonly rms?: ForgeRmsHosting;
  readonly industrial?: ForgeIndustrialHosting;
  readonly tenantAdmin?: ForgeTenantAdminHosting;

  constructor(scope: Construct, id: string, props: FrontendStackProps) {
    super(scope, id, {
      ...props,
      stackName: stackName(props.config, "Frontend"),
    });

    if (props.config.features.enableConsoleHosting) {
      this.console = new ForgeConsoleHosting(this, "Console", { config: props.config });
      exportValue(
        this,
        `${id}-ConsoleDomain`,
        this.console.distribution.distributionDomainName,
        "Creator Console CloudFront domain",
      );
      exportValue(
        this,
        `${id}-ConsoleBucket`,
        this.console.bucket.bucketName,
        "Creator Console origin bucket",
      );
      exportValue(
        this,
        `${id}-ConsoleDistributionId`,
        this.console.distribution.distributionId,
        "Creator Console CloudFront distribution ID",
      );
    }

    if (props.config.features.enableRmsHosting) {
      this.rms = new ForgeRmsHosting(this, "Rms", { config: props.config });
      exportValue(
        this,
        `${id}-RmsDomain`,
        this.rms.distribution.distributionDomainName,
        "RMS Web CloudFront domain",
      );
      exportValue(this, `${id}-RmsBucket`, this.rms.bucket.bucketName, "RMS Web origin bucket");
      exportValue(
        this,
        `${id}-RmsDistributionId`,
        this.rms.distribution.distributionId,
        "RMS Web CloudFront distribution ID",
      );
    }

    if (props.config.features.enableIndustrialHosting) {
      this.industrial = new ForgeIndustrialHosting(this, "Industrial", { config: props.config });
      exportValue(
        this,
        `${id}-IndustrialDomain`,
        this.industrial.distribution.distributionDomainName,
        "Industrial Safety CloudFront domain",
      );
      exportValue(
        this,
        `${id}-IndustrialBucket`,
        this.industrial.bucket.bucketName,
        "Industrial Safety origin bucket",
      );
      exportValue(
        this,
        `${id}-IndustrialDistributionId`,
        this.industrial.distribution.distributionId,
        "Industrial Safety CloudFront distribution ID",
      );
    }

    if (props.config.features.enableTenantAdminHosting) {
      this.tenantAdmin = new ForgeTenantAdminHosting(this, "TenantAdmin", {
        config: props.config,
      });
      exportValue(
        this,
        `${id}-TenantAdminDomain`,
        this.tenantAdmin.distribution.distributionDomainName,
        "Tenant Admin CloudFront domain",
      );
      exportValue(
        this,
        `${id}-TenantAdminBucket`,
        this.tenantAdmin.bucket.bucketName,
        "Tenant Admin origin bucket",
      );
      exportValue(
        this,
        `${id}-TenantAdminDistributionId`,
        this.tenantAdmin.distribution.distributionId,
        "Tenant Admin CloudFront distribution ID",
      );
    }

    new ForgeBudgets(this, "Budgets", { config: props.config });
  }
}
