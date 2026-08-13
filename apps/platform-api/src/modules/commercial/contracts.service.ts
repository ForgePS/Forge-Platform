import { Inject, Injectable } from "@nestjs/common";
import { CONTRACT_STATUSES } from "@forge/contracts";
import {
  createId,
  subscriptionContracts,
  subscriptions,
  type Database,
  withTenantTransaction,
} from "@forge/database";
import { ForgeError } from "@forge/errors";
import type { ForgePrincipal } from "@forge/tenant-context";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { DATABASE } from "../../tokens.js";
import { AuditService } from "../audit/audit.service.js";
import { CommercialSequencesService } from "./commercial-sequences.service.js";

const createSchema = z.object({
  subscriptionId: z.string().uuid(),
  contractType: z.string().min(1).max(64).default("MSA"),
  title: z.string().min(1).max(300),
  status: z.enum(CONTRACT_STATUSES).default("DRAFT"),
  documentKey: z.string().max(512).optional(),
  effectiveFrom: z.string().datetime().optional(),
  effectiveTo: z.string().datetime().optional(),
  notes: z.string().max(4000).optional(),
});

const patchSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  status: z.enum(CONTRACT_STATUSES).optional(),
  documentKey: z.string().max(512).optional().nullable(),
  effectiveFrom: z.string().datetime().optional().nullable(),
  effectiveTo: z.string().datetime().optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
  contractType: z.string().min(1).max(64).optional(),
});

/** Contract metadata only — no e-sign integration in S1. */
@Injectable()
export class ContractsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly sequences: CommercialSequencesService,
    private readonly audit: AuditService,
  ) {}

  async list(tenantId: string, subscriptionId?: string) {
    return withTenantTransaction(this.db, tenantId, async (tx) => {
      return tx.query.subscriptionContracts.findMany({
        where: subscriptionId
          ? and(
              eq(subscriptionContracts.tenantId, tenantId),
              eq(subscriptionContracts.subscriptionId, subscriptionId),
            )
          : eq(subscriptionContracts.tenantId, tenantId),
        orderBy: [desc(subscriptionContracts.createdAt)],
      });
    });
  }

  async create(tenantId: string, input: unknown, principal: ForgePrincipal) {
    const data = createSchema.parse(input);
    return withTenantTransaction(
      this.db,
      tenantId,
      async (tx) => {
        const sub = await tx.query.subscriptions.findFirst({
          where: and(
            eq(subscriptions.id, data.subscriptionId),
            eq(subscriptions.tenantId, tenantId),
          ),
        });
        if (!sub) throw new ForgeError("NOT_FOUND", "Subscription not found");

        const contractNumber = await this.sequences.nextNumber(tx, "CONTRACT");
        const now = new Date();
        const [row] = await tx
          .insert(subscriptionContracts)
          .values({
            id: createId(),
            tenantId,
            subscriptionId: data.subscriptionId,
            contractNumber,
            contractType: data.contractType,
            status: data.status,
            title: data.title,
            documentKey: data.documentKey,
            effectiveFrom: data.effectiveFrom ? new Date(data.effectiveFrom) : null,
            effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : null,
            notes: data.notes,
            createdAt: now,
            updatedAt: now,
          })
          .returning();

        await this.audit.writeInTransaction(tx, {
          tenantId,
          actorUserId: principal.userId,
          actorPersonId: principal.personId,
          actorType: "USER",
          action: "commercial.contract.create",
          resourceType: "subscription_contract",
          resourceId: row!.id,
          result: "SUCCESS",
          riskLevel: "MEDIUM",
          correlationId: principal.correlationId,
          requestId: principal.requestId,
          after: row,
        });
        return row;
      },
      principal.userId,
    );
  }

  async update(
    tenantId: string,
    contractId: string,
    input: unknown,
    principal: ForgePrincipal,
  ) {
    const data = patchSchema.parse(input);
    return withTenantTransaction(
      this.db,
      tenantId,
      async (tx) => {
        const before = await tx.query.subscriptionContracts.findFirst({
          where: and(
            eq(subscriptionContracts.id, contractId),
            eq(subscriptionContracts.tenantId, tenantId),
          ),
        });
        if (!before) throw new ForgeError("NOT_FOUND", "Contract not found");

        const [updated] = await tx
          .update(subscriptionContracts)
          .set({
            ...(data.title !== undefined ? { title: data.title } : {}),
            ...(data.status !== undefined ? { status: data.status } : {}),
            ...(data.documentKey !== undefined ? { documentKey: data.documentKey } : {}),
            ...(data.contractType !== undefined ? { contractType: data.contractType } : {}),
            ...(data.notes !== undefined ? { notes: data.notes } : {}),
            ...(data.effectiveFrom !== undefined
              ? {
                  effectiveFrom: data.effectiveFrom ? new Date(data.effectiveFrom) : null,
                }
              : {}),
            ...(data.effectiveTo !== undefined
              ? { effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : null }
              : {}),
            updatedAt: new Date(),
          })
          .where(eq(subscriptionContracts.id, contractId))
          .returning();

        await this.audit.writeInTransaction(tx, {
          tenantId,
          actorUserId: principal.userId,
          actorPersonId: principal.personId,
          actorType: "USER",
          action: "commercial.contract.update",
          resourceType: "subscription_contract",
          resourceId: contractId,
          result: "SUCCESS",
          riskLevel: "MEDIUM",
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
