import { Construct } from "constructs";
import type { ForgeEnvironmentConfig } from "../config/environment-schema.js";
import { ForgeStaticHosting } from "./forge-static-hosting.js";

export interface ForgeTenantAdminHostingProps {
  config: ForgeEnvironmentConfig;
}

/** Tenant Admin static hosting (Configuration Platform delegated console). */
export class ForgeTenantAdminHosting extends ForgeStaticHosting {
  constructor(scope: Construct, id: string, props: ForgeTenantAdminHostingProps) {
    super(scope, id, {
      config: props.config,
      appKey: "tenantadmin",
      displayName: "Tenant Admin",
    });
  }
}
