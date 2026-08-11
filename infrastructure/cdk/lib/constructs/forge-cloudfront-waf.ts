import * as cdk from "aws-cdk-lib";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as logs from "aws-cdk-lib/aws-logs";
import * as wafv2 from "aws-cdk-lib/aws-wafv2";
import { Construct } from "constructs";
import type { ForgeEnvironmentConfig } from "../config/environment-schema.js";
import { resourceName } from "../utils/naming.js";

export interface ForgeCloudFrontWafProps {
  config: ForgeEnvironmentConfig;
  /** CloudFront distribution IDs to associate (same-region / us-east-1). */
  distributionIds: string[];
  /** Optional WAF log group (must already allow WAF delivery). */
  logGroup?: logs.ILogGroup;
}

/**
 * CLOUDFRONT-scope WebACL for SPA/API edges. Must be created in us-east-1.
 */
export class ForgeCloudFrontWaf extends Construct {
  readonly webAcl: wafv2.CfnWebACL;

  constructor(scope: Construct, id: string, props: ForgeCloudFrontWafProps) {
    super(scope, id);
    const { config } = props;

    this.webAcl = new wafv2.CfnWebACL(this, "WebAcl", {
      name: resourceName(config, "waf", "cloudfront"),
      scope: "CLOUDFRONT",
      defaultAction: { allow: {} },
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: resourceName(config, "waf", "cloudfront"),
        sampledRequestsEnabled: true,
      },
      rules: [
        {
          name: "AWSManagedRulesAmazonIpReputationList",
          priority: 0,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: "AWS",
              name: "AWSManagedRulesAmazonIpReputationList",
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: "CfIpReputation",
            sampledRequestsEnabled: true,
          },
        },
        {
          name: "AWSManagedRulesCommonRuleSet",
          priority: 1,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: "AWS",
              name: "AWSManagedRulesCommonRuleSet",
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: "CfCommonRuleSet",
            sampledRequestsEnabled: true,
          },
        },
        {
          name: "AWSManagedRulesKnownBadInputsRuleSet",
          priority: 2,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: "AWS",
              name: "AWSManagedRulesKnownBadInputsRuleSet",
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: "CfKnownBadInputs",
            sampledRequestsEnabled: true,
          },
        },
        {
          name: "RateLimitPerIp",
          priority: 3,
          action: { block: {} },
          statement: {
            rateBasedStatement: {
              limit: 2000,
              aggregateKeyType: "IP",
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: "CfRateLimitPerIp",
            sampledRequestsEnabled: true,
          },
        },
      ],
    });

    for (const [index, distributionId] of props.distributionIds.entries()) {
      new wafv2.CfnWebACLAssociation(this, `Assoc${index}`, {
        resourceArn: `arn:${cdk.Stack.of(this).partition}:cloudfront::${config.account}:distribution/${distributionId}`,
        webAclArn: this.webAcl.attrArn,
      });
    }
  }
}
