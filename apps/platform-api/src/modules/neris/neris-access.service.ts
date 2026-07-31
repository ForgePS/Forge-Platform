import { Inject, Injectable } from "@nestjs/common";
import {
  featureDefinitions,
  featureOverrides,
  type Database,
  withTenantTransaction,
} from "@forge/database";
import { ForgeError } from "@forge/errors";
import { resolveFeatureValue } from "@forge/authorization";
import type { ForgePrincipal } from "@forge/tenant-context";
import { and, eq, isNull } from "drizzle-orm";
import { DATABASE } from "../../tokens.js";

const REGISTRY_FLAG = "rms.neris.registry.enabled";
const SCHEMA_BROWSER_FLAG = "rms.neris.schema_browser.enabled";

@Injectable()
export class NerisAccessService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async assertRegistryEnabled(principal: ForgePrincipal): Promise<void> {
    if (principal.isPlatformAdmin) return;
    const enabled = await this.resolveFlag(principal.tenantId, REGISTRY_FLAG, true);
    if (!enabled) {
      throw new ForgeError("FORBIDDEN", "NERIS schema registry is disabled for this tenant");
    }
  }

  /** Creator schema browser APIs — flag off hides unfinished surfaces (platform admin bypass). */
  async assertSchemaBrowserEnabled(principal: ForgePrincipal): Promise<void> {
    await this.assertRegistryEnabled(principal);
    if (principal.isPlatformAdmin) return;
    const enabled = await this.resolveFlag(principal.tenantId, SCHEMA_BROWSER_FLAG, false);
    if (!enabled) {
      throw new ForgeError(
        "FORBIDDEN",
        "NERIS schema browser is not enabled for this tenant (rms.neris.schema_browser.enabled)",
      );
    }
  }

  private async resolveFlag(
    tenantId: string,
    key: string,
    fallbackDefault: boolean,
  ): Promise<boolean> {
    return withTenantTransaction(this.db, tenantId, async (tx) => {
      const def = await tx.query.featureDefinitions.findFirst({
        where: eq(featureDefinitions.key, key),
      });
      if (!def) return fallbackDefault;
      const tenantOv = await tx.query.featureOverrides.findFirst({
        where: and(
          eq(featureOverrides.tenantId, tenantId),
          eq(featureOverrides.featureDefinitionId, def.id),
          isNull(featureOverrides.organizationId),
          isNull(featureOverrides.userId),
        ),
      });
      const value = resolveFeatureValue({
        tenant: tenantOv?.valueJson as unknown,
        defaultValue: def.defaultValueJson as unknown,
      });
      return Boolean(value);
    });
  }
}
