import * as cdk from "aws-cdk-lib";
import type { Construct } from "constructs";

export function exportValue(
  scope: Construct,
  id: string,
  value: string,
  description: string,
): void {
  new cdk.CfnOutput(scope, id, {
    value,
    description,
    exportName: id,
  });
}
