import { Construct } from "constructs";
import type { ForgeEnvironmentConfig } from "../config/environment-schema.js";
import { ForgeStaticHosting } from "./forge-static-hosting.js";

export interface ForgeConsoleHostingProps {
  config: ForgeEnvironmentConfig;
}

/** Creator Console static hosting (ADR-026). Thin wrapper over ForgeStaticHosting. */
export class ForgeConsoleHosting extends ForgeStaticHosting {
  constructor(scope: Construct, id: string, props: ForgeConsoleHostingProps) {
    super(scope, id, {
      config: props.config,
      appKey: "console",
      displayName: "Creator Console",
      domainName: props.config.domains?.creator,
      certificateArn: props.config.edge.certificateArn,
    });
  }
}
