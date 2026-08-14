import { Inject, Injectable } from "@nestjs/common";
import {
  createPlanInputSchema,
  type CreatePlanInput,
  PLAN_STATUSES,
  BILLING_FREQUENCIES,
} from "@forge/contracts";
import {
  createId,
  subscriptionPlans,
  subscriptionPlanVersions,
  type Database,
} from "@forge/database";
import { ForgeError } from "@forge/errors";
import type { ForgePrincipal } from "@forge/tenant-context";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { DATABASE } from "../../tokens.js";
import { AuditService } from "../audit/audit.service.js";
import { withPlatformTransaction } from "./commercial-platform.js";

const patchPlanSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  status: z.enum(PLAN_STATUSES).optional(),
  basePriceCents: z.number().int().nonnegative().optional(),
  currency: z.string().length(3).optional(),
  configurationJson: z.record(z.unknown()).optional(),
  billingInterval: z.enum(BILLING_FREQUENCIES).optional(),
});

const createVersionSchema = z.object({
  name: z.string().min(1).max(200),
  billingFrequency: z.enum(BILLING_FREQUENCIES),
  basePriceCents: z.number().int().nonnegative(),
  implementationFeeCents: z.number().int().nonnegative().default(0),
  currency: z.string().length(3).default("USD"),
  configurationJson: z.record(z.unknown()).default({}),
  status: z.enum(["DRAFT", "ACTIVE", "RETIRED"]).default("DRAFT"),
  effectiveFrom: z.string().datetime().optional(),
});

@Injectable()
export class PlansService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly audit: AuditService,
  ) {}

  async list() {
    const plans = await this.db.query.subscriptionPlans.findMany({
      orderBy: (t, { asc }) => [asc(t.code)],
    });
    const versions = await this.db.query.subscriptionPlanVersions.findMany({
      where: eq(subscriptionPlanVersions.status, "ACTIVE"),
      orderBy: [desc(subscriptionPlanVersions.versionNumber)],
    });
    const activeByPlan = new Map<string, (typeof versions)[number]>();
    for (const v of versions) {
      if (!activeByPlan.has(v.planId)) activeByPlan.set(v.planId, v);
    }
    return plans.map((p) => ({
      ...p,
      activeVersion: activeByPlan.get(p.id) ?? null,
    }));
  }

  async getById(planId: string) {
    const plan = await this.db.query.subscriptionPlans.findFirst({
      where: eq(subscriptionPlans.id, planId),
    });
    if (!plan) throw new ForgeError("NOT_FOUND", "Plan not found");
    const versions = await this.db.query.subscriptionPlanVersions.findMany({
      where: eq(subscriptionPlanVersions.planId, planId),
      orderBy: [desc(subscriptionPlanVersions.versionNumber)],
    });
    return { ...plan, versions };
  }

  async create(input: unknown, principal: ForgePrincipal) {
    const data = createPlanInputSchema.parse(input) as CreatePlanInput;
    const existing = await this.db.query.subscriptionPlans.findFirst({
      where: eq(subscriptionPlans.code, data.code),
    });
    if (existing) {
      throw new ForgeError("CONFLICT", `Plan code ${data.code} already exists`);
    }
    const now = new Date();
    const planId = createId();
    const versionId = createId();

    return withPlatformTransaction(this.db, async (tx) => {
      const [plan] = await tx
        .insert(subscriptionPlans)
        .values({
          id: planId,
          code: data.code,
          name: data.name,
          billingInterval: data.billingFrequency,
          status: data.status,
          basePriceCents: data.basePriceCents,
          currency: data.currency,
          configurationJson: data.configurationJson,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      if (!plan) throw new ForgeError("INTERNAL_ERROR", "Failed to create plan");

      const [version] = await tx
        .insert(subscriptionPlanVersions)
        .values({
          id: versionId,
          planId,
          versionNumber: 1,
          name: data.name,
          billingFrequency: data.billingFrequency,
          basePriceCents: data.basePriceCents,
          implementationFeeCents: data.implementationFeeCents,
          currency: data.currency,
          configurationJson: data.configurationJson,
          status: data.status === "RETIRED" ? "RETIRED" : data.status === "ACTIVE" ? "ACTIVE" : "DRAFT",
          effectiveFrom: data.effectiveFrom ? new Date(data.effectiveFrom) : now,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      await this.audit.writeInTransaction(tx, {
        tenantId: principal.tenantId,
        actorUserId: principal.userId,
        actorPersonId: principal.personId,
        actorType: "USER",
        action: "commercial.plan.create",
        resourceType: "subscription_plan",
        resourceId: planId,
        result: "SUCCESS",
        riskLevel: "HIGH",
        correlationId: principal.correlationId,
        requestId: principal.requestId,
        after: { plan, version },
      });

      return { ...plan, activeVersion: version };
    });
  }

  async patch(planId: string, input: unknown, principal: ForgePrincipal) {
    const data = patchPlanSchema.parse(input);
    const before = await this.db.query.subscriptionPlans.findFirst({
      where: eq(subscriptionPlans.id, planId),
    });
    if (!before) throw new ForgeError("NOT_FOUND", "Plan not found");

    const now = new Date();
    return withPlatformTransaction(this.db, async (tx) => {
      const [updated] = await tx
        .update(subscriptionPlans)
        .set({
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.status !== undefined ? { status: data.status } : {}),
          ...(data.basePriceCents !== undefined ? { basePriceCents: data.basePriceCents } : {}),
          ...(data.currency !== undefined ? { currency: data.currency } : {}),
          ...(data.configurationJson !== undefined
            ? { configurationJson: data.configurationJson }
            : {}),
          ...(data.billingInterval !== undefined
            ? { billingInterval: data.billingInterval }
            : {}),
          updatedAt: now,
        })
        .where(eq(subscriptionPlans.id, planId))
        .returning();
      if (!updated) throw new ForgeError("INTERNAL_ERROR", "Failed to update plan");

      if (data.status === "RETIRED") {
        await tx
          .update(subscriptionPlanVersions)
          .set({ status: "RETIRED", updatedAt: now })
          .where(
            and(
              eq(subscriptionPlanVersions.planId, planId),
              eq(subscriptionPlanVersions.status, "ACTIVE"),
            ),
          );
      }

      await this.audit.writeInTransaction(tx, {
        tenantId: principal.tenantId,
        actorUserId: principal.userId,
        actorPersonId: principal.personId,
        actorType: "USER",
        action: "commercial.plan.update",
        resourceType: "subscription_plan",
        resourceId: planId,
        result: "SUCCESS",
        riskLevel: "MEDIUM",
        correlationId: principal.correlationId,
        requestId: principal.requestId,
        before,
        after: updated,
      });
      return updated;
    });
  }

  async createVersion(planId: string, input: unknown, principal: ForgePrincipal) {
    const data = createVersionSchema.parse(input);
    const plan = await this.db.query.subscriptionPlans.findFirst({
      where: eq(subscriptionPlans.id, planId),
    });
    if (!plan) throw new ForgeError("NOT_FOUND", "Plan not found");

    const now = new Date();
    return withPlatformTransaction(this.db, async (tx) => {
      const [{ max } = { max: 0 }] = await tx
        .select({
          max: sql<number>`coalesce(max(${subscriptionPlanVersions.versionNumber}), 0)`,
        })
        .from(subscriptionPlanVersions)
        .where(eq(subscriptionPlanVersions.planId, planId));

      const versionNumber = Number(max ?? 0) + 1;

      if (data.status === "ACTIVE") {
        await tx
          .update(subscriptionPlanVersions)
          .set({ status: "RETIRED", updatedAt: now })
          .where(
            and(
              eq(subscriptionPlanVersions.planId, planId),
              eq(subscriptionPlanVersions.status, "ACTIVE"),
            ),
          );
      }

      const [version] = await tx
        .insert(subscriptionPlanVersions)
        .values({
          id: createId(),
          planId,
          versionNumber,
          name: data.name,
          billingFrequency: data.billingFrequency,
          basePriceCents: data.basePriceCents,
          implementationFeeCents: data.implementationFeeCents,
          currency: data.currency,
          configurationJson: data.configurationJson,
          status: data.status,
          effectiveFrom: data.effectiveFrom ? new Date(data.effectiveFrom) : now,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      await this.audit.writeInTransaction(tx, {
        tenantId: principal.tenantId,
        actorUserId: principal.userId,
        actorPersonId: principal.personId,
        actorType: "USER",
        action: "commercial.plan.version.create",
        resourceType: "subscription_plan_version",
        resourceId: version!.id,
        result: "SUCCESS",
        riskLevel: "HIGH",
        correlationId: principal.correlationId,
        requestId: principal.requestId,
        after: version,
      });

      return version;
    });
  }
}
