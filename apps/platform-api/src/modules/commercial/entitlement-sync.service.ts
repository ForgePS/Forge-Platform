import { Injectable } from "@nestjs/common";
import type { AccessPolicy } from "@forge/contracts";
import {
  createId,
  platformModules,
  platformProducts,
  subscriptionItems,
  tenantModuleEntitlements,
  tenantProducts,
  type DatabaseTransaction,
} from "@forge/database";
import { DOMAIN_EVENT_TYPES } from "@forge/events";
import type { ForgePrincipal } from "@forge/tenant-context";
import { and, eq, inArray, sql } from "drizzle-orm";
import { OutboxService } from "../outbox/outbox.service.js";
import { entitlementStatusForAccessPolicy } from "./commercial-money.js";

export type EntitlementSyncState = "COMPLETE" | "FAILED";

/**
 * Sync tenant_products / tenant_module_entitlements from subscription_items.
 *
 * Suspend accessPolicy behavior (see entitlementStatusForAccessPolicy):
 * - WRITE_RESTRICTED / READ_ONLY → module stays ACTIVE; configurationJson.accessPolicy set
 * - SUSPENDED → module status GRACE + configurationJson.accessPolicy = SUSPENDED
 * - On cancel effective → disable entitlements with sourceType SUBSCRIPTION
 */
@Injectable()
export class EntitlementSyncService {
  constructor(private readonly outbox: OutboxService) {}

  async applySubscriptionEntitlements(
    tx: DatabaseTransaction,
    tenantId: string,
    subscriptionId: string,
    principal: ForgePrincipal,
    opts?: {
      mode?: "ACTIVATE" | "SUSPEND" | "CANCEL" | "REACTIVATE";
      accessPolicy?: AccessPolicy;
    },
  ): Promise<{ state: EntitlementSyncState; detail?: string }> {
    try {
      const mode = opts?.mode ?? "ACTIVATE";
      const items = await tx.query.subscriptionItems.findMany({
        where: and(
          eq(subscriptionItems.tenantId, tenantId),
          eq(subscriptionItems.subscriptionId, subscriptionId),
          inArray(subscriptionItems.status, ["ACTIVE", "PENDING"]),
        ),
      });

      const now = new Date();

      if (mode === "CANCEL") {
        await tx
          .update(tenantModuleEntitlements)
          .set({
            status: "SUSPENDED",
            endsAt: now,
            configurationJson: sql`coalesce(${tenantModuleEntitlements.configurationJson}, '{}'::jsonb) || '{"accessPolicy":"SUSPENDED","disabledBy":"SUBSCRIPTION_CANCEL"}'::jsonb`,
            recordVersion: sql`${tenantModuleEntitlements.recordVersion} + 1`,
            updatedAt: now,
          })
          .where(
            and(
              eq(tenantModuleEntitlements.tenantId, tenantId),
              eq(tenantModuleEntitlements.sourceType, "SUBSCRIPTION"),
              eq(tenantModuleEntitlements.sourceId, subscriptionId),
            ),
          );

        await this.outbox.write(tx, {
          tenantId,
          aggregateType: "subscription",
          aggregateId: subscriptionId,
          eventType: DOMAIN_EVENT_TYPES.ENTITLEMENT_CHANGED,
          payload: { tenantId, subscriptionId, mode: "CANCEL" },
          correlationId: principal.correlationId,
          actorUserId: principal.userId,
        });
        return { state: "COMPLETE" };
      }

      const productCodes = [
        ...new Set(
          items
            .filter((i) => i.itemType === "PRODUCT" && i.productCode)
            .map((i) => i.productCode as string),
        ),
      ];
      const moduleCodes = [
        ...new Set(
          items
            .filter((i) => (i.itemType === "MODULE" || i.itemType === "ADDON") && i.moduleCode)
            .map((i) => i.moduleCode as string),
        ),
      ];

      for (const code of productCodes) {
        const product = await tx.query.platformProducts.findFirst({
          where: eq(platformProducts.code, code),
        });
        if (!product) continue;
        const existing = await tx.query.tenantProducts.findFirst({
          where: and(
            eq(tenantProducts.tenantId, tenantId),
            eq(tenantProducts.productId, product.id),
          ),
        });
        const status = mode === "SUSPEND" ? "DISABLED" : "ACTIVE";
        if (existing) {
          await tx
            .update(tenantProducts)
            .set({
              status,
              disabledAt: status === "DISABLED" ? now : null,
              recordVersion: sql`${tenantProducts.recordVersion} + 1`,
              updatedAt: now,
            })
            .where(eq(tenantProducts.id, existing.id));
        } else if (mode !== "SUSPEND") {
          await tx.insert(tenantProducts).values({
            id: createId(),
            tenantId,
            productId: product.id,
            status: "ACTIVE",
            enabledAt: now,
            configurationJson: { sourceType: "SUBSCRIPTION", sourceId: subscriptionId },
            createdAt: now,
            updatedAt: now,
          });
        }
      }

      const accessPolicy = opts?.accessPolicy ?? "FULL_ACCESS";
      const { moduleStatus, accessFlag } =
        mode === "SUSPEND"
          ? entitlementStatusForAccessPolicy(accessPolicy)
          : { moduleStatus: "ACTIVE" as const, accessFlag: "FULL_ACCESS" as AccessPolicy };

      for (const code of moduleCodes) {
        const mod = await tx.query.platformModules.findFirst({
          where: eq(platformModules.code, code),
        });
        if (!mod) continue;
        const existing = await tx.query.tenantModuleEntitlements.findFirst({
          where: and(
            eq(tenantModuleEntitlements.tenantId, tenantId),
            eq(tenantModuleEntitlements.moduleId, mod.id),
          ),
        });
        const configurationJson = {
          accessPolicy: accessFlag,
          sourceSubscriptionId: subscriptionId,
        };
        if (existing) {
          await tx
            .update(tenantModuleEntitlements)
            .set({
              status: moduleStatus,
              sourceType: "SUBSCRIPTION",
              sourceId: subscriptionId,
              configurationJson,
              endsAt: mode === "SUSPEND" && moduleStatus === "GRACE" ? undefined : existing.endsAt,
              recordVersion: sql`${tenantModuleEntitlements.recordVersion} + 1`,
              updatedAt: now,
            })
            .where(eq(tenantModuleEntitlements.id, existing.id));
        } else if (mode !== "SUSPEND") {
          await tx.insert(tenantModuleEntitlements).values({
            id: createId(),
            tenantId,
            moduleId: mod.id,
            status: "ACTIVE",
            sourceType: "SUBSCRIPTION",
            sourceId: subscriptionId,
            startsAt: now,
            configurationJson,
            createdAt: now,
            updatedAt: now,
          });
        }
      }

      await this.outbox.write(tx, {
        tenantId,
        aggregateType: "subscription",
        aggregateId: subscriptionId,
        eventType: DOMAIN_EVENT_TYPES.ENTITLEMENT_CHANGED,
        payload: { tenantId, subscriptionId, mode, accessPolicy: accessFlag },
        correlationId: principal.correlationId,
        actorUserId: principal.userId,
      });

      return { state: "COMPLETE" };
    } catch (err) {
      return {
        state: "FAILED",
        detail: err instanceof Error ? err.message : "entitlement sync failed",
      };
    }
  }
}
