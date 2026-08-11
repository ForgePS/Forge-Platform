import { Construct } from "constructs";
import type { ForgeEnvironmentConfig } from "../config/environment-schema.js";
import { ForgeStaticHosting } from "./forge-static-hosting.js";

export interface ForgeRmsHostingProps {
  config: ForgeEnvironmentConfig;
}

/** RMS Web static hosting (NERIS Phase 2). Thin wrapper over ForgeStaticHosting. */
export class ForgeRmsHosting extends ForgeStaticHosting {
  constructor(scope: Construct, id: string, props: ForgeRmsHostingProps) {
    super(scope, id, {
      config: props.config,
      appKey: "rms",
      displayName: "RMS Web",
      domainName: props.config.domains?.rms,
      certificateArn: props.config.edge.certificateArn,
    });
  }
}
