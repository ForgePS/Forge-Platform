import { Inject, Injectable } from "@nestjs/common";
import {
  createId,
  industrialEquipment,
  industrialIncidents,
  industrialInspections,
  industrialJsas,
  industrialLotoProcedures,
  industrialObservations,
  industrialPersonnel,
  industrialSites,
  type Database,
  withTenantTransaction,
} from "@forge/database";
import { ForgeError } from "@forge/errors";
import type { ForgePrincipal } from "@forge/tenant-context";
import { and, desc, eq, ilike, isNull, or } from "drizzle-orm";
import { DATABASE } from "../../tokens.js";

type ListQuery = Record<string, string | undefined>;

/**
 * Flat `/api/v1/industrial/*` domain operations against Model A (normalized tables).
 * Replaces the diverged branch's industrial_ops_records-backed ops service.
 */
@Injectable()
export class IndustrialDomainService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  private page(query: ListQuery) {
    const page = Math.max(1, Number(query.page ?? 1) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize ?? 50) || 50));
    return { page, pageSize, offset: (page - 1) * pageSize };
  }

  private mapListItem(row: {
    id: string;
    title?: string | null;
    displayName?: string | null;
    name?: string | null;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    sourcePayload?: unknown;
  }) {
    const title = row.title ?? row.displayName ?? row.name ?? row.id;
    const payload =
      row.sourcePayload && typeof row.sourcePayload === "object" && !Array.isArray(row.sourcePayload)
        ? (row.sourcePayload as Record<string, unknown>)
        : {};
    return {
      id: row.id,
      title,
      displayName: title,
      status: row.status,
      ...payload,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async listPersonnel(principal: ForgePrincipal, query: ListQuery) {
    const { page, pageSize, offset } = this.page(query);
    const q = (query.q ?? "").trim();
    const status = (query.status ?? "").trim();
    return withTenantTransaction(this.db, principal.tenantId, async (tx) => {
      const conditions = [
        eq(industrialPersonnel.tenantId, principal.tenantId),
        isNull(industrialPersonnel.archivedAt),
      ];
      if (status) conditions.push(eq(industrialPersonnel.status, status));
      if (q) {
        conditions.push(
          or(
            ilike(industrialPersonnel.displayName, `%${q}%`),
            ilike(industrialPersonnel.employeeNumber, `%${q}%`),
            ilike(industrialPersonnel.email, `%${q}%`),
          )!,
        );
      }
      const items = await tx
        .select()
        .from(industrialPersonnel)
        .where(and(...conditions))
        .orderBy(desc(industrialPersonnel.updatedAt))
        .limit(pageSize)
        .offset(offset);
      return {
        page,
        pageSize,
        items: items.map((r) =>
          this.mapListItem({
            id: r.id,
            displayName: r.displayName,
            status: r.status,
            createdAt: r.createdAt,
            updatedAt: r.updatedAt,
            sourcePayload: r.sourcePayload,
          }),
        ),
      };
    });
  }

  async listSites(principal: ForgePrincipal, query: ListQuery) {
    const { page, pageSize, offset } = this.page(query);
    return withTenantTransaction(this.db, principal.tenantId, async (tx) => {
      const items = await tx
        .select()
        .from(industrialSites)
        .where(
          and(eq(industrialSites.tenantId, principal.tenantId), isNull(industrialSites.archivedAt)),
        )
        .orderBy(desc(industrialSites.updatedAt))
        .limit(pageSize)
        .offset(offset);
      return {
        page,
        pageSize,
        items: items.map((r) =>
          this.mapListItem({
            id: r.id,
            name: r.name,
            status: r.status,
            createdAt: r.createdAt,
            updatedAt: r.updatedAt,
            sourcePayload: r.sourcePayload,
          }),
        ),
      };
    });
  }

  async listEquipment(principal: ForgePrincipal, query: ListQuery) {
    const { page, pageSize, offset } = this.page(query);
    const q = (query.q ?? "").trim();
    return withTenantTransaction(this.db, principal.tenantId, async (tx) => {
      const conditions = [
        eq(industrialEquipment.tenantId, principal.tenantId),
        isNull(industrialEquipment.archivedAt),
      ];
      if (q) {
        conditions.push(
          or(
            ilike(industrialEquipment.name, `%${q}%`),
            ilike(industrialEquipment.equipmentNumber, `%${q}%`),
          )!,
        );
      }
      const items = await tx
        .select()
        .from(industrialEquipment)
        .where(and(...conditions))
        .orderBy(desc(industrialEquipment.updatedAt))
        .limit(pageSize)
        .offset(offset);
      return {
        page,
        pageSize,
        items: items.map((r) =>
          this.mapListItem({
            id: r.id,
            name: r.name,
            status: r.status,
            createdAt: r.createdAt,
            updatedAt: r.updatedAt,
            sourcePayload: {
              ...(typeof r.sourcePayload === "object" && r.sourcePayload
                ? (r.sourcePayload as object)
                : {}),
              equipmentName: r.name,
              equipmentNumber: r.equipmentNumber,
              equipmentType: r.equipmentType,
            },
          }),
        ),
      };
    });
  }

  private async listTitled(
    principal: ForgePrincipal,
    query: ListQuery,
    table:
      | typeof industrialIncidents
      | typeof industrialInspections
      | typeof industrialObservations
      | typeof industrialJsas
      | typeof industrialLotoProcedures,
  ) {
    const { page, pageSize, offset } = this.page(query);
    const q = (query.q ?? "").trim();
    const status = (query.status ?? "").trim();
    return withTenantTransaction(this.db, principal.tenantId, async (tx) => {
      const conditions = [eq(table.tenantId, principal.tenantId), isNull(table.archivedAt)];
      if (status) conditions.push(eq(table.status, status));
      if (q) conditions.push(ilike(table.title, `%${q}%`));
      const items = await tx
        .select()
        .from(table)
        .where(and(...conditions))
        .orderBy(desc(table.updatedAt))
        .limit(pageSize)
        .offset(offset);
      return {
        page,
        pageSize,
        items: items.map((r) =>
          this.mapListItem({
            id: r.id,
            title: r.title,
            status: r.status,
            createdAt: r.createdAt,
            updatedAt: r.updatedAt,
            sourcePayload: r.sourcePayload,
          }),
        ),
      };
    });
  }

  listIncidents(p: ForgePrincipal, q: ListQuery) {
    return this.listTitled(p, q, industrialIncidents);
  }
  listInspections(p: ForgePrincipal, q: ListQuery) {
    return this.listTitled(p, q, industrialInspections);
  }
  listObservations(p: ForgePrincipal, q: ListQuery) {
    return this.listTitled(p, q, industrialObservations);
  }
  listJsas(p: ForgePrincipal, q: ListQuery) {
    return this.listTitled(p, q, industrialJsas);
  }
  listLoto(p: ForgePrincipal, q: ListQuery) {
    return this.listTitled(p, q, industrialLotoProcedures);
  }

  async createIncident(principal: ForgePrincipal, body: Record<string, unknown>) {
    const title = String(body.title ?? "").trim();
    if (!title) throw new ForgeError("VALIDATION_FAILED", "title is required");
    const status = String(body.status ?? "OPEN").trim() || "OPEN";
    return withTenantTransaction(this.db, principal.tenantId, async (tx) => {
      const now = new Date();
      const [row] = await tx
        .insert(industrialIncidents)
        .values({
          id: createId(),
          tenantId: principal.tenantId,
          title,
          status,
          sourceSystem: "FORGE",
          sourcePayload: body,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      return this.mapListItem({
        id: row!.id,
        title: row!.title,
        status: row!.status,
        createdAt: row!.createdAt,
        updatedAt: row!.updatedAt,
        sourcePayload: row!.sourcePayload,
      });
    });
  }

  async createInspection(principal: ForgePrincipal, body: Record<string, unknown>) {
    const title = String(body.title ?? "").trim();
    if (!title) throw new ForgeError("VALIDATION_FAILED", "title is required");
    const status = String(body.status ?? "OPEN").trim() || "OPEN";
    return withTenantTransaction(this.db, principal.tenantId, async (tx) => {
      const now = new Date();
      const [row] = await tx
        .insert(industrialInspections)
        .values({
          id: createId(),
          tenantId: principal.tenantId,
          title,
          status,
          sourceSystem: "FORGE",
          sourcePayload: body,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      return this.mapListItem({
        id: row!.id,
        title: row!.title,
        status: row!.status,
        createdAt: row!.createdAt,
        updatedAt: row!.updatedAt,
        sourcePayload: row!.sourcePayload,
      });
    });
  }

  async getIncident(principal: ForgePrincipal, id: string) {
    return withTenantTransaction(this.db, principal.tenantId, async (tx) => {
      const [row] = await tx
        .select()
        .from(industrialIncidents)
        .where(
          and(
            eq(industrialIncidents.id, id),
            eq(industrialIncidents.tenantId, principal.tenantId),
          ),
        )
        .limit(1);
      if (!row) throw new ForgeError("NOT_FOUND", "Incident not found");
      return this.mapListItem({
        id: row.id,
        title: row.title,
        status: row.status,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        sourcePayload: row.sourcePayload,
      });
    });
  }

  async getInspection(principal: ForgePrincipal, id: string) {
    return withTenantTransaction(this.db, principal.tenantId, async (tx) => {
      const [row] = await tx
        .select()
        .from(industrialInspections)
        .where(
          and(
            eq(industrialInspections.id, id),
            eq(industrialInspections.tenantId, principal.tenantId),
          ),
        )
        .limit(1);
      if (!row) throw new ForgeError("NOT_FOUND", "Inspection not found");
      return this.mapListItem({
        id: row.id,
        title: row.title,
        status: row.status,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        sourcePayload: row.sourcePayload,
      });
    });
  }

  async getPersonnel(principal: ForgePrincipal, id: string) {
    return withTenantTransaction(this.db, principal.tenantId, async (tx) => {
      const [row] = await tx
        .select()
        .from(industrialPersonnel)
        .where(
          and(
            eq(industrialPersonnel.id, id),
            eq(industrialPersonnel.tenantId, principal.tenantId),
          ),
        )
        .limit(1);
      if (!row) throw new ForgeError("NOT_FOUND", "Personnel not found");
      return this.mapListItem({
        id: row.id,
        displayName: row.displayName,
        status: row.status,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        sourcePayload: {
          ...(typeof row.sourcePayload === "object" && row.sourcePayload
            ? (row.sourcePayload as object)
            : {}),
          firstName: row.firstName,
          lastName: row.lastName,
          email: row.email,
          employeeNumber: row.employeeNumber,
        },
      });
    });
  }
}
