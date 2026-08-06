import { Inject, Injectable } from "@nestjs/common";
import { createTenantInputSchema, type CreateTenantInput } from "@forge/contracts";
import { createId, tenants, type Database, withTenantTransaction } from "@forge/database";
import { ForgeError } from "@forge/errors";
import { DOMAIN_EVENT_TYPES } from "@forge/events";
import type { ForgePrincipal } from "@forge/tenant-context";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { concurrencyConflict } from "../../common/concurrency.js";
import { DATABASE } from "../../tokens.js";
import { AuditService } from "../audit/audit.service.js";
import { OutboxService } from "../outbox/outbox.service.js";

const patchTenantSchema = z.object({
  legalName: z.string().min(1).max(300).optional(),
  displayName: z.string().min(1).max(300).optional(),
  timezone: z.string().min(1).max(64).optional(),
  defaultLocale: z.string().min(2).max(16).optional(),
});

const suspendSchema = z.object({
  reason: z.string().min(1).max(2000),
});

export type ExpectedVersion = number | "*";

@Injectable()
export class TenantsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Guards an optimistic update. Returns the version that must appear in the
   * UPDATE's WHERE clause so a concurrent writer cannot slip in between the
   * read and the write.
   */
  private assertVersion(tenantId: string, current: number, expected: ExpectedVersion): number {
    if (expected !== "*" && current !== expected) {
      throw concurrencyConflict({
        tenantId,
        resourceType: "tenant",
        resourceId: tenantId,
        expectedVersion: expected,
        actualVersion: current,
      });
    }
    return current;
  }

  async create(input: unknown, principal: ForgePrincipal) {
    const data = createTenantInputSchema.parse(input) as CreateTenantInput;
    const id = createId();
    const now = new Date();

    // Tenant row is platform-global; outbox/audit use the new tenant id.
    await this.db.transaction(async (tx) => {
      await tx.insert(tenants).values({
        id,
        tenantKey: data.tenantKey,
        slug: data.slug,
        legalName: data.legalName,
        displayName: data.displayName,
        tenantType: data.tenantType ?? "CUSTOMER",
        status: "PROVISIONING",
        timezone: data.timezone ?? "America/Chicago",
        defaultLocale: data.defaultLocale ?? "en-US",
        dataRegion: data.dataRegion ?? "us-east-1",
        createdByUserId: principal.userId,
        updatedByUserId: principal.userId,
        createdAt: now,
        updatedAt: now,
      });

      await this.outbox.write(tx, {
        tenantId: id,
        aggregateType: "tenant",
        aggregateId: id,
        eventType: DOMAIN_EVENT_TYPES.TENANT_CREATED,
        payload: {
          tenantId: id,
          tenantKey: data.tenantKey,
          slug: data.slug,
          status: "PROVISIONING",
        },
        correlationId: principal.correlationId,
        actorUserId: principal.userId,
      });

      await this.audit.writeInTransaction(tx, {
        tenantId: id,
        actorUserId: principal.userId,
        actorPersonId: principal.personId,
        actorType: "USER",
        action: "tenant.create",
        resourceType: "tenant",
        resourceId: id,
        result: "SUCCESS",
        riskLevel: "MEDIUM",
        correlationId: principal.correlationId,
        requestId: principal.requestId,
        after: { id, status: "PROVISIONING", tenantKey: data.tenantKey },
      });
    });

    return this.getById(id);
  }

  async list() {
    return this.db.query.tenants.findMany({
      orderBy: (t, { asc }) => [asc(t.displayName)],
    });
  }

  async getById(tenantId: string) {
    const row = await this.db.query.tenants.findFirst({
      where: eq(tenants.id, tenantId),
    });
    if (!row) {
      throw new ForgeError("NOT_FOUND", "Tenant not found");
    }
    return row;
  }

  async patch(
    tenantId: string,
    input: unknown,
    principal: ForgePrincipal,
    expectedVersion: ExpectedVersion,
  ) {
    const data = patchTenantSchema.parse(input);
    return withTenantTransaction(
      this.db,
      tenantId,
      async (tx) => {
        const before = await tx.query.tenants.findFirst({ where: eq(tenants.id, tenantId) });
        if (!before) {
          throw new ForgeError("NOT_FOUND", "Tenant not found");
        }
        const version = this.assertVersion(tenantId, before.recordVersion, expectedVersion);
        const [updated] = await tx
          .update(tenants)
          .set({
            ...data,
            recordVersion: version + 1,
            updatedAt: new Date(),
            updatedByUserId: principal.userId,
          })
          .where(and(eq(tenants.id, tenantId), eq(tenants.recordVersion, version)))
          .returning();
        if (!updated) {
          throw concurrencyConflict({
            tenantId,
            resourceType: "tenant",
            resourceId: tenantId,
            expectedVersion,
            actualVersion: null,
          });
        }

        await this.audit.writeInTransaction(tx, {
          tenantId,
          actorUserId: principal.userId,
          actorPersonId: principal.personId,
          actorType: "USER",
          action: "tenant.update",
          resourceType: "tenant",
          resourceId: tenantId,
          result: "SUCCESS",
          riskLevel: "LOW",
          correlationId: principal.correlationId,
          requestId: principal.requestId,
          before,
          after: updated,
        });
        return updated;
      },
      principal.userId,
    );
  }

  async activate(tenantId: string, principal: ForgePrincipal, expectedVersion: ExpectedVersion) {
    return withTenantTransaction(
      this.db,
      tenantId,
      async (tx) => {
        const before = await tx.query.tenants.findFirst({ where: eq(tenants.id, tenantId) });
        if (!before) {
          throw new ForgeError("NOT_FOUND", "Tenant not found");
        }
        if (before.status !== "PROVISIONING" && before.status !== "SUSPENDED") {
          throw new ForgeError("CONFLICT", `Cannot activate tenant from status ${before.status}`);
        }
        const version = this.assertVersion(tenantId, before.recordVersion, expectedVersion);
        const [updated] = await tx
          .update(tenants)
          .set({
            status: "ACTIVE",
            suspensionReason: null,
            suspendedAt: null,
            recordVersion: version + 1,
            updatedAt: new Date(),
            updatedByUserId: principal.userId,
          })
          .where(and(eq(tenants.id, tenantId), eq(tenants.recordVersion, version)))
          .returning();
        if (!updated) {
          throw concurrencyConflict({
            tenantId,
            resourceType: "tenant",
            resourceId: tenantId,
            expectedVersion,
            actualVersion: null,
          });
        }

        await this.outbox.write(tx, {
          tenantId,
          aggregateType: "tenant",
          aggregateId: tenantId,
          eventType: DOMAIN_EVENT_TYPES.TENANT_ACTIVATED,
          payload: { tenantId, previousStatus: before.status, status: "ACTIVE" },
          correlationId: principal.correlationId,
          actorUserId: principal.userId,
        });
        await this.audit.writeInTransaction(tx, {
          tenantId,
          actorUserId: principal.userId,
          actorPersonId: principal.personId,
          actorType: "USER",
          action: "tenant.activate",
          resourceType: "tenant",
          resourceId: tenantId,
          result: "SUCCESS",
          riskLevel: "HIGH",
          correlationId: principal.correlationId,
          requestId: principal.requestId,
          before,
          after: updated,
        });
        return updated;
      },
      principal.userId,
    );
  }

  async suspend(
    tenantId: string,
    input: unknown,
    principal: ForgePrincipal,
    expectedVersion: ExpectedVersion,
  ) {
    const { reason } = suspendSchema.parse(input);
    return withTenantTransaction(
      this.db,
      tenantId,
      async (tx) => {
        const before = await tx.query.tenants.findFirst({ where: eq(tenants.id, tenantId) });
        if (!before) {
          throw new ForgeError("NOT_FOUND", "Tenant not found");
        }
        const version = this.assertVersion(tenantId, before.recordVersion, expectedVersion);
        const now = new Date();
        const [updated] = await tx
          .update(tenants)
          .set({
            status: "SUSPENDED",
            suspensionReason: reason,
            suspendedAt: now,
            recordVersion: version + 1,
            updatedAt: now,
            updatedByUserId: principal.userId,
          })
          .where(and(eq(tenants.id, tenantId), eq(tenants.recordVersion, version)))
          .returning();
        if (!updated) {
          throw concurrencyConflict({
            tenantId,
            resourceType: "tenant",
            resourceId: tenantId,
            expectedVersion,
            actualVersion: null,
          });
        }

        await this.outbox.write(tx, {
          tenantId,
          aggregateType: "tenant",
          aggregateId: tenantId,
          eventType: DOMAIN_EVENT_TYPES.TENANT_SUSPENDED,
          payload: { tenantId, reason, status: "SUSPENDED" },
          correlationId: principal.correlationId,
          actorUserId: principal.userId,
        });
        await this.audit.writeInTransaction(tx, {
          tenantId,
          actorUserId: principal.userId,
          actorPersonId: principal.personId,
          actorType: "USER",
          action: "tenant.suspend",
          resourceType: "tenant",
          resourceId: tenantId,
          result: "SUCCESS",
          riskLevel: "CRITICAL",
          correlationId: principal.correlationId,
          requestId: principal.requestId,
          before,
          after: updated,
          metadata: { reason },
        });
        return updated;
      },
      principal.userId,
    );
  }

  async archive(tenantId: string, principal: ForgePrincipal, expectedVersion: ExpectedVersion) {
    return withTenantTransaction(
      this.db,
      tenantId,
      async (tx) => {
        const before = await tx.query.tenants.findFirst({ where: eq(tenants.id, tenantId) });
        if (!before) {
          throw new ForgeError("NOT_FOUND", "Tenant not found");
        }
        const version = this.assertVersion(tenantId, before.recordVersion, expectedVersion);
        const now = new Date();
        const [updated] = await tx
          .update(tenants)
          .set({
            status: "ARCHIVED",
            archivedAt: now,
            recordVersion: version + 1,
            updatedAt: now,
            updatedByUserId: principal.userId,
          })
          .where(and(eq(tenants.id, tenantId), eq(tenants.recordVersion, version)))
          .returning();
        if (!updated) {
          throw concurrencyConflict({
            tenantId,
            resourceType: "tenant",
            resourceId: tenantId,
            expectedVersion,
            actualVersion: null,
          });
        }

        await this.outbox.write(tx, {
          tenantId,
          aggregateType: "tenant",
          aggregateId: tenantId,
          eventType: DOMAIN_EVENT_TYPES.TENANT_ARCHIVED,
          payload: { tenantId, status: "ARCHIVED" },
          correlationId: principal.correlationId,
          actorUserId: principal.userId,
        });
        await this.audit.writeInTransaction(tx, {
          tenantId,
          actorUserId: principal.userId,
          actorPersonId: principal.personId,
          actorType: "USER",
          action: "tenant.archive",
          resourceType: "tenant",
          resourceId: tenantId,
          result: "SUCCESS",
          riskLevel: "HIGH",
          correlationId: principal.correlationId,
          requestId: principal.requestId,
          before,
          after: updated,
        });
        return updated;
      },
      principal.userId,
    );
  }
}
