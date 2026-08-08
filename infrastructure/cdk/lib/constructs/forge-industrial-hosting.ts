import { Construct } from "constructs";
import type { ForgeEnvironmentConfig } from "../config/environment-schema.js";
import { ForgeStaticHosting } from "./forge-static-hosting.js";

export interface ForgeIndustrialHostingProps {
  config: ForgeEnvironmentConfig;
}

/** Industrial Safety static hosting. Thin wrapper over ForgeStaticHosting. */
export class ForgeIndustrialHosting extends ForgeStaticHosting {
  constructor(scope: Construct, id: string, props: ForgeIndustrialHostingProps) {
    super(scope, id, {
      config: props.config,
      appKey: "industrial",
      displayName: "Industrial Safety",
    });
  }
}
