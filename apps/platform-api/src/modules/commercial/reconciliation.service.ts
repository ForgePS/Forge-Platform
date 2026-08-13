import { Inject, Injectable } from "@nestjs/common";
import {
  createId,
  platformModules,
  platformProducts,
  subscriptionItems,
  tenantModuleEntitlements,
  tenantProducts,
  type Database,
  withTenantTransaction,
} from "@forge/database";
import { DOMAIN_EVENT_TYPES } from "@forge/events";
import type { ForgePrincipal } from "@forge/tenant-context";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { DATABASE } from "../../tokens.js";
import { AuditService } from "../audit/audit.service.js";
import { OutboxService } from "../outbox/outbox.service.js";

const applySchema = z.object({
  /** When true, create missing entitlements / disable extras from SUBSCRIPTION source. */
  apply: z.literal(true),
  subscriptionId: z.string().uuid().optional(),
  note: z.string().min(1).max(2000),
});

export type ReconcileDrift = {
  kind: "MISSING_PRODUCT" | "MISSING_MODULE" | "EXTRA_MODULE" | "STATUS_MISMATCH";
  code: string;
  expected?: string;
  actual?: string;
  subscriptionId?: string | null;
};

@Injectable()
export class ReconciliationService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
  ) {}

  async reconcile(tenantId: string) {
    return withTenantTransaction(this.db, tenantId, async (tx) => {
      const items = await tx.query.subscriptionItems.findMany({
        where: and(
          eq(subscriptionItems.tenantId, tenantId),
          eq(subscriptionItems.status, "ACTIVE"),
        ),
      });

      const expectedProducts = new Set(
        items.filter((i) => i.itemType === "PRODUCT" && i.productCode).map((i) => i.productCode!),
      );
      const expectedModules = new Set(
        items
          .filter((i) => (i.itemType === "MODULE" || i.itemType === "ADDON") && i.moduleCode)
          .map((i) => i.moduleCode!),
      );

      const products = await tx
        .select({
          id: tenantProducts.id,
          status: tenantProducts.status,
          code: platformProducts.code,
        })
        .from(tenantProducts)
        .innerJoin(platformProducts, eq(platformProducts.id, tenantProducts.productId))
        .where(eq(tenantProducts.tenantId, tenantId));

      const modules = await tx
        .select({
          id: tenantModuleEntitlements.id,
          status: tenantModuleEntitlements.status,
          sourceType: tenantModuleEntitlements.sourceType,
          sourceId: tenantModuleEntitlements.sourceId,
          code: platformModules.code,
        })
        .from(tenantModuleEntitlements)
        .innerJoin(platformModules, eq(platformModules.id, tenantModuleEntitlements.moduleId))
        .where(eq(tenantModuleEntitlements.tenantId, tenantId));

      const drift: ReconcileDrift[] = [];
      const productCodes = new Set(products.map((p) => p.code));
      const moduleByCode = new Map(modules.map((m) => [m.code, m]));

      for (const code of expectedProducts) {
        if (!productCodes.has(code)) {
          drift.push({ kind: "MISSING_PRODUCT", code });
        }
      }
      for (const code of expectedModules) {
        const row = moduleByCode.get(code);
        if (!row) {
          drift.push({ kind: "MISSING_MODULE", code });
        } else if (row.status !== "ACTIVE" && row.status !== "GRACE") {
          drift.push({
            kind: "STATUS_MISMATCH",
            code,
            expected: "ACTIVE",
            actual: row.status,
            subscriptionId: row.sourceId,
          });
        }
      }
      for (const m of modules) {
        if (m.sourceType === "SUBSCRIPTION" && !expectedModules.has(m.code) && m.status === "ACTIVE") {
          drift.push({
            kind: "EXTRA_MODULE",
            code: m.code,
            subscriptionId: m.sourceId,
          });
        }
      }

      return {
        tenantId,
        expected: {
          products: [...expectedProducts],
          modules: [...expectedModules],
        },
        drift,
        inSync: drift.length === 0,
      };
    });
  }

  /** Apply reconciliation with mandatory audit — never silent. */
  async apply(tenantId: string, input: unknown, principal: ForgePrincipal) {
    const data = applySchema.parse(input);
    const report = await this.reconcile(tenantId);
    if (report.inSync) {
      return { ...report, applied: false, message: "Already in sync" };
    }

    return withTenantTransaction(
      this.db,
      tenantId,
      async (tx) => {
        const now = new Date();
        const applied: ReconcileDrift[] = [];

        for (const d of report.drift) {
          if (d.kind === "MISSING_PRODUCT") {
            const product = await tx.query.platformProducts.findFirst({
              where: eq(platformProducts.code, d.code),
            });
            if (!product) continue;
            const existing = await tx.query.tenantProducts.findFirst({
              where: and(
                eq(tenantProducts.tenantId, tenantId),
                eq(tenantProducts.productId, product.id),
              ),
            });
            if (existing) {
              await tx
                .update(tenantProducts)
                .set({
                  status: "ACTIVE",
                  disabledAt: null,
                  recordVersion: sql`${tenantProducts.recordVersion} + 1`,
                  updatedAt: now,
                })
                .where(eq(tenantProducts.id, existing.id));
            } else {
              await tx.insert(tenantProducts).values({
                id: createId(),
                tenantId,
                productId: product.id,
                status: "ACTIVE",
                enabledAt: now,
                configurationJson: { reconciled: true },
                createdAt: now,
                updatedAt: now,
              });
            }
            applied.push(d);
          }

          if (d.kind === "MISSING_MODULE" || d.kind === "STATUS_MISMATCH") {
            const mod = await tx.query.platformModules.findFirst({
              where: eq(platformModules.code, d.code),
            });
            if (!mod) continue;
            const existing = await tx.query.tenantModuleEntitlements.findFirst({
              where: and(
                eq(tenantModuleEntitlements.tenantId, tenantId),
                eq(tenantModuleEntitlements.moduleId, mod.id),
              ),
            });
            if (existing) {
              await tx
                .update(tenantModuleEntitlements)
                .set({
                  status: "ACTIVE",
                  sourceType: "SUBSCRIPTION",
                  sourceId: data.subscriptionId ?? existing.sourceId,
                  recordVersion: sql`${tenantModuleEntitlements.recordVersion} + 1`,
                  updatedAt: now,
                })
                .where(eq(tenantModuleEntitlements.id, existing.id));
            } else {
              await tx.insert(tenantModuleEntitlements).values({
                id: createId(),
                tenantId,
                moduleId: mod.id,
                status: "ACTIVE",
                sourceType: "SUBSCRIPTION",
                sourceId: data.subscriptionId ?? null,
                startsAt: now,
                configurationJson: { reconciled: true },
                createdAt: now,
                updatedAt: now,
              });
            }
            applied.push(d);
          }

          if (d.kind === "EXTRA_MODULE") {
            const mod = await tx.query.platformModules.findFirst({
              where: eq(platformModules.code, d.code),
            });
            if (!mod) continue;
            await tx
              .update(tenantModuleEntitlements)
              .set({
                status: "SUSPENDED",
                endsAt: now,
                recordVersion: sql`${tenantModuleEntitlements.recordVersion} + 1`,
                updatedAt: now,
              })
              .where(
                and(
                  eq(tenantModuleEntitlements.tenantId, tenantId),
                  eq(tenantModuleEntitlements.moduleId, mod.id),
                  eq(tenantModuleEntitlements.sourceType, "SUBSCRIPTION"),
                ),
              );
            applied.push(d);
          }
        }

        await this.outbox.write(tx, {
          tenantId,
          aggregateType: "tenant",
          aggregateId: tenantId,
          eventType: DOMAIN_EVENT_TYPES.ENTITLEMENT_CHANGED,
          payload: { tenantId, reconcile: true, applied, note: data.note },
          correlationId: principal.correlationId,
          actorUserId: principal.userId,
        });

        await this.audit.writeInTransaction(tx, {
          tenantId,
          actorUserId: principal.userId,
          actorPersonId: principal.personId,
          actorType: "USER",
          action: "commercial.reconcile.apply",
          resourceType: "tenant",
          resourceId: tenantId,
          result: "SUCCESS",
          riskLevel: "HIGH",
          correlationId: principal.correlationId,
          requestId: principal.requestId,
          after: { note: data.note, applied, driftBefore: report.drift },
        });

        return { tenantId, applied: true, appliedDrift: applied, note: data.note };
      },
      principal.userId,
    );
  }
}
