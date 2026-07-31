import { Inject, Injectable } from "@nestjs/common";
import {
  createId,
  platformModules,
  platformProducts,
  tenantModuleEntitlements,
  tenantProducts,
  type Database,
  withTenantTransaction,
} from "@forge/database";
import { ForgeError } from "@forge/errors";
import { DOMAIN_EVENT_TYPES } from "@forge/events";
import type { ForgePrincipal } from "@forge/tenant-context";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { concurrencyConflict } from "../../common/concurrency.js";
import { DATABASE } from "../../tokens.js";
import { AuditService } from "../audit/audit.service.js";
import { OutboxService } from "../outbox/outbox.service.js";

type ExpectedVersion = number | "*";

const putProductSchema = z.object({
  status: z.enum(["ACTIVE", "DISABLED"]).default("ACTIVE"),
  configuration: z.record(z.unknown()).optional(),
});

const putModuleSchema = z.object({
  status: z.enum(["ACTIVE", "PENDING", "SUSPENDED", "GRACE"]).default("ACTIVE"),
  sourceType: z.string().max(64).default("MANUAL"),
  quantityLimit: z.number().int().positive().optional().nullable(),
  configuration: z.record(z.unknown()).optional(),
});

@Injectable()
export class EntitlementsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
  ) {}

  async list(tenantId: string) {
    return withTenantTransaction(this.db, tenantId, async (tx) => {
      const products = await tx
        .select({
          id: tenantProducts.id,
          status: tenantProducts.status,
          productCode: platformProducts.code,
          productName: platformProducts.name,
          enabledAt: tenantProducts.enabledAt,
          configurationJson: tenantProducts.configurationJson,
        })
        .from(tenantProducts)
        .innerJoin(platformProducts, eq(platformProducts.id, tenantProducts.productId))
        .where(eq(tenantProducts.tenantId, tenantId));

      const modules = await tx
        .select({
          id: tenantModuleEntitlements.id,
          status: tenantModuleEntitlements.status,
          moduleCode: platformModules.code,
          moduleName: platformModules.name,
          startsAt: tenantModuleEntitlements.startsAt,
          endsAt: tenantModuleEntitlements.endsAt,
          configurationJson: tenantModuleEntitlements.configurationJson,
        })
        .from(tenantModuleEntitlements)
        .innerJoin(platformModules, eq(platformModules.id, tenantModuleEntitlements.moduleId))
        .where(eq(tenantModuleEntitlements.tenantId, tenantId));

      return { products, modules };
    });
  }

  async putProduct(
    tenantId: string,
    productCode: string,
    input: unknown,
    principal: ForgePrincipal,
  ) {
    const data = putProductSchema.parse(input);
    return withTenantTransaction(this.db, tenantId, async (tx) => {
      const product = await tx.query.platformProducts.findFirst({
        where: eq(platformProducts.code, productCode),
      });
      if (!product) {
        throw new ForgeError("NOT_FOUND", "Product not found");
      }
      const existing = await tx.query.tenantProducts.findFirst({
        where: and(
          eq(tenantProducts.tenantId, tenantId),
          eq(tenantProducts.productId, product.id),
        ),
      });
      const now = new Date();
      let row;
      if (existing) {
        // Upsert update path: bump recordVersion without If-Match.
        [row] = await tx
          .update(tenantProducts)
          .set({
            status: data.status,
            configurationJson: data.configuration ?? existing.configurationJson,
            disabledAt: data.status === "DISABLED" ? now : null,
            recordVersion: sql`${tenantProducts.recordVersion} + 1`,
            updatedAt: now,
          })
          .where(eq(tenantProducts.id, existing.id))
          .returning();
      } else {
        [row] = await tx
          .insert(tenantProducts)
          .values({
            id: createId(),
            tenantId,
            productId: product.id,
            status: data.status,
            enabledAt: now,
            configurationJson: data.configuration ?? {},
            createdAt: now,
            updatedAt: now,
          })
          .returning();
      }
      if (!row) {
        throw new Error("Failed to upsert tenant product");
      }
      await this.outbox.write(tx, {
        tenantId,
        aggregateType: "tenant_product",
        aggregateId: row.id,
        eventType: DOMAIN_EVENT_TYPES.ENTITLEMENT_CHANGED,
        payload: { tenantId, productCode, status: data.status },
        correlationId: principal.correlationId,
        actorUserId: principal.userId,
      });
      await this.audit.writeInTransaction(tx, {
        tenantId,
        actorUserId: principal.userId,
        actorPersonId: principal.personId,
        actorType: "USER",
        action: "entitlement.product.put",
        resourceType: "tenant_product",
        resourceId: row.id,
        result: "SUCCESS",
        riskLevel: "HIGH",
        correlationId: principal.correlationId,
        requestId: principal.requestId,
        after: row,
      });
      return row;
    }, principal.userId);
  }

  async putModule(
    tenantId: string,
    moduleCode: string,
    input: unknown,
    principal: ForgePrincipal,
  ) {
    const data = putModuleSchema.parse(input);
    return withTenantTransaction(this.db, tenantId, async (tx) => {
      const mod = await tx.query.platformModules.findFirst({
        where: eq(platformModules.code, moduleCode),
      });
      if (!mod) {
        throw new ForgeError("NOT_FOUND", "Module not found");
      }
      const existing = await tx.query.tenantModuleEntitlements.findFirst({
        where: and(
          eq(tenantModuleEntitlements.tenantId, tenantId),
          eq(tenantModuleEntitlements.moduleId, mod.id),
        ),
      });
      const now = new Date();
      let row;
      if (existing) {
        // Upsert update path: bump recordVersion without If-Match.
        [row] = await tx
          .update(tenantModuleEntitlements)
          .set({
            status: data.status,
            sourceType: data.sourceType,
            quantityLimit: data.quantityLimit ?? existing.quantityLimit,
            configurationJson: data.configuration ?? existing.configurationJson,
            recordVersion: sql`${tenantModuleEntitlements.recordVersion} + 1`,
            updatedAt: now,
          })
          .where(eq(tenantModuleEntitlements.id, existing.id))
          .returning();
      } else {
        [row] = await tx
          .insert(tenantModuleEntitlements)
          .values({
            id: createId(),
            tenantId,
            moduleId: mod.id,
            status: data.status,
            sourceType: data.sourceType,
            quantityLimit: data.quantityLimit,
            startsAt: now,
            configurationJson: data.configuration ?? {},
            createdAt: now,
            updatedAt: now,
          })
          .returning();
      }
      if (!row) {
        throw new Error("Failed to upsert module entitlement");
      }
      await this.outbox.write(tx, {
        tenantId,
        aggregateType: "tenant_module_entitlement",
        aggregateId: row.id,
        eventType: DOMAIN_EVENT_TYPES.ENTITLEMENT_CHANGED,
        payload: { tenantId, moduleCode, status: data.status },
        correlationId: principal.correlationId,
        actorUserId: principal.userId,
      });
      return row;
    }, principal.userId);
  }

  async setModuleStatus(
    tenantId: string,
    moduleCode: string,
    status: "SUSPENDED" | "ACTIVE",
    principal: ForgePrincipal,
    expectedVersion: ExpectedVersion,
  ) {
    return withTenantTransaction(this.db, tenantId, async (tx) => {
      const mod = await tx.query.platformModules.findFirst({
        where: eq(platformModules.code, moduleCode),
      });
      if (!mod) {
        throw new ForgeError("NOT_FOUND", "Module not found");
      }
      const before = await tx.query.tenantModuleEntitlements.findFirst({
        where: and(
          eq(tenantModuleEntitlements.tenantId, tenantId),
          eq(tenantModuleEntitlements.moduleId, mod.id),
        ),
      });
      if (!before) {
        throw new ForgeError("NOT_FOUND", "Module entitlement not found");
      }
      const version = before.recordVersion;
      if (expectedVersion !== "*" && version !== expectedVersion) {
        throw concurrencyConflict({
          tenantId,
          resourceType: "entitlement",
          resourceId: before.id,
          expectedVersion,
          actualVersion: version,
        });
      }
      const [updated] = await tx
        .update(tenantModuleEntitlements)
        .set({ status, recordVersion: version + 1, updatedAt: new Date() })
        .where(
          and(
            eq(tenantModuleEntitlements.id, before.id),
            eq(tenantModuleEntitlements.recordVersion, version),
          ),
        )
        .returning();
      if (!updated) {
        throw concurrencyConflict({
          tenantId,
          resourceType: "entitlement",
          resourceId: before.id,
          expectedVersion,
          actualVersion: null,
        });
      }
      await this.outbox.write(tx, {
        tenantId,
        aggregateType: "tenant_module_entitlement",
        aggregateId: updated.id,
        eventType: DOMAIN_EVENT_TYPES.ENTITLEMENT_CHANGED,
        payload: { tenantId, moduleCode, status },
        correlationId: principal.correlationId,
        actorUserId: principal.userId,
      });
      return updated;
    }, principal.userId);
  }
}
