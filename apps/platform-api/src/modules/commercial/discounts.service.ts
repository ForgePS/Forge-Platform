import { Inject, Injectable } from "@nestjs/common";
import { createDiscountInputSchema, type CreateDiscountInput } from "@forge/contracts";
import {
  createId,
  discountDefinitions,
  subscriptionDiscountLinks,
  subscriptions,
  type Database,
  withTenantTransaction,
} from "@forge/database";
import { ForgeError } from "@forge/errors";
import type { ForgePrincipal } from "@forge/tenant-context";
import { and, desc, eq, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { DATABASE } from "../../tokens.js";
import { AuditService } from "../audit/audit.service.js";
import { withPlatformTransaction } from "./commercial-platform.js";

const linkSchema = z.object({
  discountId: z.string().uuid(),
  reason: z.string().max(2000).optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
});

@Injectable()
export class DiscountsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly audit: AuditService,
  ) {}

  async list(tenantId?: string | null) {
    if (tenantId) {
      return withTenantTransaction(this.db, tenantId, async (tx) => {
        return tx.query.discountDefinitions.findMany({
          where: or(isNull(discountDefinitions.tenantId), eq(discountDefinitions.tenantId, tenantId)),
          orderBy: [desc(discountDefinitions.createdAt)],
        });
      });
    }
    return withPlatformTransaction(this.db, async (tx) => {
      return tx.query.discountDefinitions.findMany({
        orderBy: [desc(discountDefinitions.createdAt)],
      });
    });
  }

  async create(input: unknown, principal: ForgePrincipal) {
    const data = createDiscountInputSchema.parse(input) as CreateDiscountInput;
    if (data.discountType === "PERCENT" && data.percentBps == null) {
      throw new ForgeError("VALIDATION_FAILED", "percentBps required for PERCENT discounts");
    }
    if (data.discountType === "FIXED" && data.amountCents == null) {
      throw new ForgeError("VALIDATION_FAILED", "amountCents required for FIXED discounts");
    }

    const now = new Date();
    const values = {
      id: createId(),
      tenantId: data.tenantId ?? null,
      code: data.code,
      name: data.name,
      discountType: data.discountType,
      percentBps: data.percentBps ?? null,
      amountCents: data.amountCents ?? null,
      stackable: data.stackable,
      startsAt: data.startsAt ? new Date(data.startsAt) : null,
      endsAt: data.endsAt ? new Date(data.endsAt) : null,
      status: data.status,
      configurationJson: data.configurationJson,
      createdAt: now,
      updatedAt: now,
    };

    if (data.tenantId) {
      return withTenantTransaction(
        this.db,
        data.tenantId,
        async (tx) => {
          const [row] = await tx.insert(discountDefinitions).values(values).returning();
          await this.audit.writeInTransaction(tx, {
            tenantId: data.tenantId!,
            actorUserId: principal.userId,
            actorPersonId: principal.personId,
            actorType: "USER",
            action: "commercial.discount.create",
            resourceType: "discount_definition",
            resourceId: row!.id,
            result: "SUCCESS",
            riskLevel: "HIGH",
            correlationId: principal.correlationId,
            requestId: principal.requestId,
            after: row,
          });
          return row;
        },
        principal.userId,
      );
    }

    return withPlatformTransaction(this.db, async (tx) => {
      const [row] = await tx.insert(discountDefinitions).values(values).returning();
      await this.audit.writeInTransaction(tx, {
        tenantId: principal.tenantId,
        actorUserId: principal.userId,
        actorPersonId: principal.personId,
        actorType: "USER",
        action: "commercial.discount.create",
        resourceType: "discount_definition",
        resourceId: row!.id,
        result: "SUCCESS",
        riskLevel: "HIGH",
        correlationId: principal.correlationId,
        requestId: principal.requestId,
        after: row,
      });
      return row;
    });
  }

  async linkToSubscription(
    tenantId: string,
    subscriptionId: string,
    input: unknown,
    principal: ForgePrincipal,
  ) {
    const data = linkSchema.parse(input);
    return withTenantTransaction(
      this.db,
      tenantId,
      async (tx) => {
        const sub = await tx.query.subscriptions.findFirst({
          where: and(eq(subscriptions.id, subscriptionId), eq(subscriptions.tenantId, tenantId)),
        });
        if (!sub) throw new ForgeError("NOT_FOUND", "Subscription not found");

        const discount = await tx.query.discountDefinitions.findFirst({
          where: eq(discountDefinitions.id, data.discountId),
        });
        if (!discount) throw new ForgeError("NOT_FOUND", "Discount not found");

        const [link] = await tx
          .insert(subscriptionDiscountLinks)
          .values({
            id: createId(),
            tenantId,
            subscriptionId,
            discountId: data.discountId,
            reason: data.reason,
            authorizedByUserId: principal.userId,
            startsAt: data.startsAt ? new Date(data.startsAt) : null,
            endsAt: data.endsAt ? new Date(data.endsAt) : null,
            createdAt: new Date(),
          })
          .returning();

        await this.audit.writeInTransaction(tx, {
          tenantId,
          actorUserId: principal.userId,
          actorPersonId: principal.personId,
          actorType: "USER",
          action: "commercial.discount.link",
          resourceType: "subscription_discount_link",
          resourceId: link!.id,
          result: "SUCCESS",
          riskLevel: "HIGH",
          correlationId: principal.correlationId,
          requestId: principal.requestId,
          after: link,
        });
        return link;
      },
      principal.userId,
    );
  }
}
