import { Inject, Injectable } from "@nestjs/common";
import {
  createId,
  tenantBranding,
  type Database,
  withTenantTransaction,
} from "@forge/database";
import type { ForgePrincipal } from "@forge/tenant-context";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { DATABASE } from "../../tokens.js";
import { AuditService } from "../audit/audit.service.js";

const putSchema = z.object({
  logoDocumentId: z.string().uuid().optional().nullable(),
  iconDocumentId: z.string().uuid().optional().nullable(),
  primaryColor: z.string().max(32).optional().nullable(),
  secondaryColor: z.string().max(32).optional().nullable(),
  accentColor: z.string().max(32).optional().nullable(),
  emailSenderName: z.string().max(200).optional().nullable(),
  supportEmail: z.string().email().max(320).optional().nullable(),
  customCssEnabled: z.boolean().optional(),
});

@Injectable()
export class BrandingService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly audit: AuditService,
  ) {}

  async get(tenantId: string) {
    return withTenantTransaction(this.db, tenantId, async (tx) => {
      const row = await tx.query.tenantBranding.findFirst({
        where: eq(tenantBranding.tenantId, tenantId),
      });
      return row ?? null;
    });
  }

  async put(tenantId: string, input: unknown, principal: ForgePrincipal) {
    const data = putSchema.parse(input);
    return withTenantTransaction(this.db, tenantId, async (tx) => {
      const existing = await tx.query.tenantBranding.findFirst({
        where: eq(tenantBranding.tenantId, tenantId),
      });
      const now = new Date();
      let row;
      if (existing) {
        // Upsert update path: bump recordVersion without If-Match.
        [row] = await tx
          .update(tenantBranding)
          .set({
            ...data,
            recordVersion: sql`${tenantBranding.recordVersion} + 1`,
            updatedAt: now,
          })
          .where(eq(tenantBranding.id, existing.id))
          .returning();
      } else {
        [row] = await tx
          .insert(tenantBranding)
          .values({
            id: createId(),
            tenantId,
            ...data,
            customCssEnabled: data.customCssEnabled ?? false,
            createdAt: now,
            updatedAt: now,
          })
          .returning();
      }
      if (!row) {
        throw new Error("Failed to upsert tenant branding");
      }
      await this.audit.writeInTransaction(tx, {
        tenantId,
        actorUserId: principal.userId,
        actorPersonId: principal.personId,
        actorType: "USER",
        action: "branding.put",
        resourceType: "tenant_branding",
        resourceId: row.id,
        result: "SUCCESS",
        riskLevel: "LOW",
        correlationId: principal.correlationId,
        requestId: principal.requestId,
        after: row,
      });
      return row;
    }, principal.userId);
  }
}
