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

const INCIDENT_SHELL_FLAG = "rms.neris.incident_shell.enabled";
const MANUAL_INTAKE_FLAG = "rms.neris.manual_intake.enabled";
const OFFICER_REVIEW_FLAG = "rms.neris.officer_review.enabled";
const SPECIALTY_WORKFLOWS_FLAG = "rms.neris.specialty_workflows.enabled";

@Injectable()
export class NerisIncidentsAccessService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async assertIncidentShellEnabled(principal: ForgePrincipal): Promise<void> {
    if (principal.isPlatformAdmin) return;
    const enabled = await this.resolveFlag(principal.tenantId, INCIDENT_SHELL_FLAG, false);
    if (!enabled) {
      throw new ForgeError(
        "FORBIDDEN",
        "NERIS incident shell is not enabled for this tenant (rms.neris.incident_shell.enabled)",
      );
    }
  }

  async assertManualIntakeEnabled(principal: ForgePrincipal): Promise<void> {
    await this.assertIncidentShellEnabled(principal);
    if (principal.isPlatformAdmin) return;
    const enabled = await this.resolveFlag(principal.tenantId, MANUAL_INTAKE_FLAG, false);
    if (!enabled) {
      throw new ForgeError(
        "FORBIDDEN",
        "Manual incident intake is not enabled for this tenant (rms.neris.manual_intake.enabled)",
      );
    }
  }

  async assertOfficerReviewEnabled(principal: ForgePrincipal): Promise<void> {
    await this.assertIncidentShellEnabled(principal);
    if (principal.isPlatformAdmin) return;
    const enabled = await this.resolveFlag(principal.tenantId, OFFICER_REVIEW_FLAG, false);
    if (!enabled) {
      throw new ForgeError(
        "FORBIDDEN",
        "Officer review workflow is not enabled for this tenant (rms.neris.officer_review.enabled)",
      );
    }
  }

  /** Phase 3 specialty workflows — defaults to false when undefined (tenant override required). */
  async isSpecialtyWorkflowsEnabled(tenantId: string): Promise<boolean> {
    return this.resolveFlag(tenantId, SPECIALTY_WORKFLOWS_FLAG, false);
  }

  async assertSpecialtyWorkflowsEnabled(principal: ForgePrincipal): Promise<void> {
    await this.assertIncidentShellEnabled(principal);
    if (principal.isPlatformAdmin) return;
    const enabled = await this.isSpecialtyWorkflowsEnabled(principal.tenantId);
    if (!enabled) {
      throw new ForgeError(
        "FORBIDDEN",
        "NERIS specialty workflows are not enabled for this tenant (rms.neris.specialty_workflows.enabled)",
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
      // Strict true only — never coerce strings like "false" via Boolean().
      return value === true;
    });
  }
}
