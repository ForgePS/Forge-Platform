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
      domainName: props.config.domains?.industrial,
      certificateArn: props.config.edge.certificateArn,
      // Module pages are fully statically exported via generateStaticParams().
      // Directory index rewrite still maps /modules/{code}/ → index.html.
    });
  }
}
