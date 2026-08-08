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
  const field = TITLE_FIELD[module];
  const value = String(payload[field] ?? "").trim();
  return value || module;
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

      const items = rows.map((row) => ({
        id: row.id,
        module: row.module,
        title: row.title,
        status: row.status,
        displayName: row.title,
        ...row.payload,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        recordVersion: row.recordVersion,
      }));

      return { items, page, pageSize };
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
    const id = createId();
    const now = new Date();

    return withTenantTransaction(this.db, principal.tenantId, async (tx) => {
      await tx.insert(industrialOpsRecords).values({
        id,
        tenantId: principal.tenantId,
        module,
        title,
        status: "ACTIVE",
        payload,
        recordVersion: 1,
        createdAt: now,
        updatedAt: now,
      });

      return {
        id,
        module,
        title,
        status: "ACTIVE",
        displayName: title,
        ...payload,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        recordVersion: 1,
      };
    });
  }
}
