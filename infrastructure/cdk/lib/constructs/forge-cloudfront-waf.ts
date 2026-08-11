import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import * as wafv2 from "aws-cdk-lib/aws-wafv2";
import * as cr from "aws-cdk-lib/custom-resources";
import { Construct } from "constructs";
import type { ForgeEnvironmentConfig } from "../config/environment-schema.js";
import { resourceName } from "../utils/naming.js";

export interface ForgeCloudFrontWafProps {
  config: ForgeEnvironmentConfig;
  /**
   * CloudFront distributions owned by this stack.
   * Associated via Distribution.webAclId (not WAFv2 WebACLAssociation).
   */
  distributions?: cloudfront.Distribution[];
  /**
   * Distribution IDs owned by another stack (e.g. API HTTPS edge in Compute).
   * Associated via CloudFront AssociateDistributionWebACL.
   */
  externalDistributionIds?: string[];
  /** Optional WAF log group (must already allow WAF delivery). */
  logGroup?: logs.ILogGroup;
}

/**
 * CLOUDFRONT-scope WebACL for SPA/API edges. Must be created in us-east-1.
 *
 * Do not use AWS::WAFv2::WebACLAssociation for CloudFront — that API rejects
 * CloudFront ARNs. SPA distributions use attachWebAclId; cross-stack IDs use
 * CloudFront AssociateDistributionWebACL.
 */
export class ForgeCloudFrontWaf extends Construct {
  readonly webAcl: wafv2.CfnWebACL;

  constructor(scope: Construct, id: string, props: ForgeCloudFrontWafProps) {
    super(scope, id);
    const { config } = props;
    const distributions = props.distributions ?? [];
    const externalIds = props.externalDistributionIds ?? [];

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

    for (const distribution of distributions) {
      distribution.attachWebAclId(this.webAcl.attrArn);
    }

    for (const [index, distributionId] of externalIds.entries()) {
      // CloudFront global control plane; stack is us-east-1 for production.
      new cr.AwsCustomResource(this, `AssocExternal${index}`, {
        onCreate: {
          service: "CloudFront",
          action: "associateDistributionWebACL",
          parameters: {
            Id: distributionId,
            WebACLArn: this.webAcl.attrArn,
          },
          physicalResourceId: cr.PhysicalResourceId.of(`cf-waf-assoc-${distributionId}`),
        },
        onUpdate: {
          service: "CloudFront",
          action: "associateDistributionWebACL",
          parameters: {
            Id: distributionId,
            WebACLArn: this.webAcl.attrArn,
          },
          physicalResourceId: cr.PhysicalResourceId.of(`cf-waf-assoc-${distributionId}`),
        },
        onDelete: {
          service: "CloudFront",
          action: "disassociateDistributionWebACL",
          parameters: {
            Id: distributionId,
          },
          physicalResourceId: cr.PhysicalResourceId.of(`cf-waf-assoc-${distributionId}`),
          ignoreErrorCodesMatching: ".*",
        },
        policy: cr.AwsCustomResourcePolicy.fromStatements([
          new iam.PolicyStatement({
            actions: [
              "cloudfront:AssociateDistributionWebACL",
              "cloudfront:DisassociateDistributionWebACL",
              "cloudfront:GetDistribution",
              "cloudfront:GetDistributionConfig",
              "wafv2:GetWebACL",
            ],
            resources: ["*"],
          }),
        ]),
        installLatestAwsSdk: true,
      });
    }
  }
}
