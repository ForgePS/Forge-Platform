import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import * as wafv2 from "aws-cdk-lib/aws-wafv2";
import { Construct } from "constructs";
import type { ForgeEnvironmentConfig } from "../config/environment-schema.js";

function retentionDays(days: number): logs.RetentionDays {
  const map: Record<number, logs.RetentionDays> = {
    30: logs.RetentionDays.ONE_MONTH,
    90: logs.RetentionDays.THREE_MONTHS,
    365: logs.RetentionDays.ONE_YEAR,
  };
  return map[days] ?? logs.RetentionDays.ONE_YEAR;
}

export interface ForgeWafLoggingProps {
  config: ForgeEnvironmentConfig;
  webAcl: wafv2.CfnWebACL;
  /** Short suffix used in `aws-waf-logs-forge-{env}-{suffix}`. */
  destinationSuffix: string;
}

/**
 * CloudWatch Logs destination for WAFv2.
 * Log group names MUST start with `aws-waf-logs-` or WAF rejects the association.
 * Authorization/cookie headers are redacted.
 */
export class ForgeWafLogging extends Construct {
  readonly logGroup: logs.LogGroup;
  readonly loggingConfiguration: wafv2.CfnLoggingConfiguration;

  constructor(scope: Construct, id: string, props: ForgeWafLoggingProps) {
    super(scope, id);
    const { config, webAcl, destinationSuffix } = props;
    const logGroupName = `aws-waf-logs-forge-${config.environmentName}-${destinationSuffix}`;

    this.logGroup = new logs.LogGroup(this, "LogGroup", {
      logGroupName,
      retention: retentionDays(config.retention.securityLogsDays),
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    this.logGroup.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: "AWSLogDeliveryWrite",
        principals: [new iam.ServicePrincipal("delivery.logs.amazonaws.com")],
        actions: ["logs:CreateLogStream", "logs:PutLogEvents"],
        resources: [this.logGroup.logGroupArn],
        conditions: {
          StringEquals: { "aws:SourceAccount": config.account },
        },
      }),
    );

    this.loggingConfiguration = new wafv2.CfnLoggingConfiguration(this, "Config", {
      resourceArn: webAcl.attrArn,
      logDestinationConfigs: [this.logGroup.logGroupArn],
    });
    // Redaction is applied post-create via AWS CLI/API where SingleHeader.Name
    // casing is reliable; CFN early-validation rejects CDK-emitted variants.
    this.loggingConfiguration.node.addDependency(this.logGroup);
  }
}
