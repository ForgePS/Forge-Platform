import { Construct } from "constructs";
import type { ForgeEnvironmentConfig } from "../config/environment-schema.js";
import { ForgeStaticHosting } from "./forge-static-hosting.js";

export interface ForgeIndustrialHostingProps {
  config: ForgeEnvironmentConfig;
}

/** Industrial Web static hosting (IND-WEB-D1 development gate). */
export class ForgeIndustrialHosting extends ForgeStaticHosting {
  constructor(scope: Construct, id: string, props: ForgeIndustrialHostingProps) {
    super(scope, id, {
      config: props.config,
      appKey: "industrial",
      displayName: "Industrial Web",
      // Module pages are fully statically exported via generateStaticParams().
      // Do not rewrite /modules/{code}/ to placeholder — that hydrates every
      // deep link as ModuleUnavailable while keeping the wrong workspace URL.
    });
  }
}
