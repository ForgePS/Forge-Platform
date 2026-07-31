import { Inject, Injectable } from "@nestjs/common";
import { buildAuditRecord, type AuditEventInput } from "@forge/audit";
import {
  auditEvents,
  createId,
  type Database,
  type DatabaseTransaction,
  withTenantTransaction,
} from "@forge/database";
import { eq } from "drizzle-orm";
import { DATABASE } from "../../tokens.js";

@Injectable()
export class AuditService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async writeInTransaction(
    tx: DatabaseTransaction,
    input: Omit<AuditEventInput, "id"> & { id?: string },
  ): Promise<string> {
    const id = input.id ?? createId();
    const record = buildAuditRecord({ ...input, id });
    await tx.insert(auditEvents).values({
      id: record.id,
      tenantId: record.tenantId,
      actorUserId: record.actorUserId,
      actorPersonId: record.actorPersonId,
      actorType: record.actorType,
      action: record.action,
      resourceType: record.resourceType,
      resourceId: record.resourceId,
      organizationId: record.organizationId,
      result: record.result,
      riskLevel: record.riskLevel,
      ipAddress: record.ipAddress,
      userAgent: record.userAgent,
      correlationId: record.correlationId,
      requestId: record.requestId,
      beforeJson: record.beforeJson as Record<string, unknown> | null,
      afterJson: record.afterJson as Record<string, unknown> | null,
      metadataJson: (record.metadataJson as Record<string, unknown>) ?? {},
      occurredAt: record.occurredAt,
    });
    return id;
  }

  async list(tenantId: string, page = 1, pageSize = 25) {
    return withTenantTransaction(this.db, tenantId, async (tx) => {
      const rows = await tx.query.auditEvents.findMany({
        where: eq(auditEvents.tenantId, tenantId),
        orderBy: (t, { desc }) => [desc(t.occurredAt)],
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });
      return rows;
    });
  }

  async getById(tenantId: string, auditEventId: string) {
    return withTenantTransaction(this.db, tenantId, async (tx) => {
      return tx.query.auditEvents.findFirst({
        where: eq(auditEvents.id, auditEventId),
      });
    });
  }
}
