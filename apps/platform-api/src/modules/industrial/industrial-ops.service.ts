import { Inject, Injectable } from "@nestjs/common";
import {
  createId,
  industrialOpsRecords,
  type Database,
  withTenantTransaction,
} from "@forge/database";
import { ForgeError } from "@forge/errors";
import type { ForgePrincipal } from "@forge/tenant-context";
import { and, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { DATABASE } from "../../tokens.js";

export const INDUSTRIAL_OPS_MODULES = [
  "personnel",
  "training",
  "forms",
  "inspections",
  "incidents",
  "jsas",
  "observations",
  "equipment",
  "sites",
  "loto",
  "dot",
  "workers-comp",
] as const;

export type IndustrialOpsModule = (typeof INDUSTRIAL_OPS_MODULES)[number];

const TITLE_FIELD: Record<IndustrialOpsModule, string> = {
  personnel: "displayName",
  training: "title",
  forms: "name",
  inspections: "title",
  incidents: "title",
  jsas: "title",
  observations: "description",
  equipment: "equipmentName",
  sites: "name",
  loto: "title",
  dot: "title",
  "workers-comp": "title",
};

function isOpsModule(value: string): value is IndustrialOpsModule {
  return (INDUSTRIAL_OPS_MODULES as readonly string[]).includes(value);
}

function titleFromPayload(module: IndustrialOpsModule, payload: Record<string, unknown>): string {
  if (module === "personnel") {
    const first = String(payload.firstName ?? "").trim();
    const last = String(payload.lastName ?? "").trim();
    const display = String(payload.displayName ?? "").trim();
    if (display) return display;
    const combined = `${first} ${last}`.trim();
    if (combined) return combined;
    return "Personnel";
  }
  if (module === "loto") {
    const title = String(payload.title ?? "").trim();
    const equipmentName = String(payload.equipmentName ?? "").trim();
    if (title) return title;
    if (equipmentName) return `LOTO · ${equipmentName}`;
    return "LOTO procedure";
  }
  if (module === "dot") {
    const title = String(payload.title ?? "").trim();
    const category = String(payload.category ?? "").trim();
    if (title) return title;
    if (category) return `DOT · ${category}`;
    return "DOT compliance item";
  }
  if (module === "workers-comp") {
    const title = String(payload.title ?? payload.caseNumber ?? "").trim();
    if (title) return title;
    const employee = payload.employee;
    const name =
      employee && typeof employee === "object" && !Array.isArray(employee)
        ? String((employee as Record<string, unknown>).employeeName ?? "").trim()
        : "";
    if (name) return `WC · ${name}`;
    return "Workers' Comp case";
  }
  const field = TITLE_FIELD[module];
  const value = String(payload[field] ?? "").trim();
  return value || module;
}

function mapRow(row: typeof industrialOpsRecords.$inferSelect) {
  return {
    id: row.id,
    module: row.module,
    title: row.title,
    status: row.status,
    displayName: row.title,
    ...row.payload,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    recordVersion: row.recordVersion,
  };
}

@Injectable()
export class IndustrialOpsService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async list(
    principal: ForgePrincipal,
    module: string,
    query: { q?: string; status?: string; page?: string; pageSize?: string },
  ) {
    if (!isOpsModule(module)) {
      throw new ForgeError("NOT_FOUND", `Unknown industrial module: ${module}`);
    }
    const page = Math.max(1, Number(query.page ?? "1") || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize ?? "25") || 25));
    const offset = (page - 1) * pageSize;
    const status = query.status?.trim() || undefined;
    const q = query.q?.trim() || undefined;

    return withTenantTransaction(this.db, principal.tenantId, async (tx) => {
      const filters = [
        eq(industrialOpsRecords.tenantId, principal.tenantId),
        eq(industrialOpsRecords.module, module),
        isNull(industrialOpsRecords.archivedAt),
      ];
      if (status) filters.push(eq(industrialOpsRecords.status, status));
      if (q) {
        filters.push(
          or(
            ilike(industrialOpsRecords.title, `%${q}%`),
            sql`${industrialOpsRecords.payload}::text ilike ${`%${q}%`}`,
          )!,
        );
      }

      const rows = await tx
        .select()
        .from(industrialOpsRecords)
        .where(and(...filters))
        .limit(pageSize)
        .offset(offset)
        .orderBy(desc(industrialOpsRecords.createdAt));

      return { items: rows.map(mapRow), page, pageSize };
    });
  }

  async get(principal: ForgePrincipal, module: string, id: string) {
    if (!isOpsModule(module)) {
      throw new ForgeError("NOT_FOUND", `Unknown industrial module: ${module}`);
    }
    return withTenantTransaction(this.db, principal.tenantId, async (tx) => {
      const [row] = await tx
        .select()
        .from(industrialOpsRecords)
        .where(
          and(
            eq(industrialOpsRecords.tenantId, principal.tenantId),
            eq(industrialOpsRecords.module, module),
            eq(industrialOpsRecords.id, id),
            isNull(industrialOpsRecords.archivedAt),
          ),
        )
        .limit(1);
      if (!row) throw new ForgeError("NOT_FOUND", "Record not found");
      return mapRow(row);
    });
  }

  async create(principal: ForgePrincipal, module: string, body: unknown) {
    if (!isOpsModule(module)) {
      throw new ForgeError("NOT_FOUND", `Unknown industrial module: ${module}`);
    }
    const payload = z.record(z.unknown()).parse(body ?? {});
    const title = titleFromPayload(module, payload);
    if (module === "personnel") {
      payload.displayName = title;
    }
    if (module === "equipment") {
      payload.equipmentName = String(payload.equipmentName ?? title).trim() || title;
    }
    const id = createId();
    const now = new Date();

    return withTenantTransaction(this.db, principal.tenantId, async (tx) => {
      await tx.insert(industrialOpsRecords).values({
        id,
        tenantId: principal.tenantId,
        module,
        title,
        status: String(payload.status ?? "ACTIVE"),
        payload,
        recordVersion: 1,
        createdAt: now,
        updatedAt: now,
      });

      return {
        id,
        module,
        title,
        status: String(payload.status ?? "ACTIVE"),
        displayName: title,
        ...payload,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        recordVersion: 1,
      };
    });
  }

  async updateStatus(principal: ForgePrincipal, module: string, id: string, body: unknown) {
    if (!isOpsModule(module)) {
      throw new ForgeError("NOT_FOUND", `Unknown industrial module: ${module}`);
    }
    const { status } = z.object({ status: z.string().min(1).max(64) }).parse(body ?? {});
    const now = new Date();
    return withTenantTransaction(this.db, principal.tenantId, async (tx) => {
      const [row] = await tx
        .update(industrialOpsRecords)
        .set({ status, updatedAt: now, recordVersion: sql`${industrialOpsRecords.recordVersion} + 1` })
        .where(
          and(
            eq(industrialOpsRecords.tenantId, principal.tenantId),
            eq(industrialOpsRecords.module, module),
            eq(industrialOpsRecords.id, id),
            isNull(industrialOpsRecords.archivedAt),
          ),
        )
        .returning();
      if (!row) throw new ForgeError("NOT_FOUND", "Record not found");
      return mapRow(row);
    });
  }

  /** Merge business fields into record payload (photos, CAPA notes, next-action metadata). */
  async updateFields(principal: ForgePrincipal, module: string, id: string, body: unknown) {
    if (!isOpsModule(module)) {
      throw new ForgeError("NOT_FOUND", `Unknown industrial module: ${module}`);
    }
    const patch = z.record(z.unknown()).parse(body ?? {});
    const now = new Date();
    return withTenantTransaction(this.db, principal.tenantId, async (tx) => {
      const [existing] = await tx
        .select()
        .from(industrialOpsRecords)
        .where(
          and(
            eq(industrialOpsRecords.tenantId, principal.tenantId),
            eq(industrialOpsRecords.module, module),
            eq(industrialOpsRecords.id, id),
            isNull(industrialOpsRecords.archivedAt),
          ),
        )
        .limit(1);
      if (!existing) throw new ForgeError("NOT_FOUND", "Record not found");

      const prevPayload =
        existing.payload && typeof existing.payload === "object" && !Array.isArray(existing.payload)
          ? (existing.payload as Record<string, unknown>)
          : {};
      const nextPayload = { ...prevPayload, ...patch };
      delete nextPayload.id;
      delete nextPayload.module;
      delete nextPayload.recordVersion;

      const nextStatus =
        typeof patch.status === "string" && patch.status.trim()
          ? String(patch.status).trim()
          : existing.status;
      const nextTitle = titleFromPayload(module, {
        ...nextPayload,
        title: nextPayload.title ?? existing.title,
      });

      const [row] = await tx
        .update(industrialOpsRecords)
        .set({
          payload: nextPayload,
          status: nextStatus,
          title: nextTitle,
          updatedAt: now,
          recordVersion: sql`${industrialOpsRecords.recordVersion} + 1`,
        })
        .where(
          and(
            eq(industrialOpsRecords.tenantId, principal.tenantId),
            eq(industrialOpsRecords.module, module),
            eq(industrialOpsRecords.id, id),
            isNull(industrialOpsRecords.archivedAt),
          ),
        )
        .returning();
      if (!row) throw new ForgeError("NOT_FOUND", "Record not found");
      return mapRow(row);
    });
  }

  async archive(principal: ForgePrincipal, module: string, id: string) {
    if (!isOpsModule(module)) {
      throw new ForgeError("NOT_FOUND", `Unknown industrial module: ${module}`);
    }
    const now = new Date();
    return withTenantTransaction(this.db, principal.tenantId, async (tx) => {
      const [row] = await tx
        .update(industrialOpsRecords)
        .set({
          archivedAt: now,
          updatedAt: now,
          status: "ARCHIVED",
          recordVersion: sql`${industrialOpsRecords.recordVersion} + 1`,
        })
        .where(
          and(
            eq(industrialOpsRecords.tenantId, principal.tenantId),
            eq(industrialOpsRecords.module, module),
            eq(industrialOpsRecords.id, id),
            isNull(industrialOpsRecords.archivedAt),
          ),
        )
        .returning();
      if (!row) throw new ForgeError("NOT_FOUND", "Record not found");
      return { id: row.id, archived: true };
    });
  }
}
