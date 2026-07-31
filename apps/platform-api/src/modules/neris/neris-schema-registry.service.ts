import { Inject, Injectable } from "@nestjs/common";
import {
  nerisFieldConditions,
  nerisFieldMappings,
  nerisFields,
  nerisModuleGroups,
  nerisModules,
  nerisSchemaImportHistory,
  nerisSchemaPackages,
  nerisSchemaValidationResults,
  nerisSchemaVersions,
  type Database,
} from "@forge/database";
import { ForgeError } from "@forge/errors";
import { and, asc, count, desc, eq, ilike, or } from "drizzle-orm";
import { DATABASE } from "../../tokens.js";

export interface PageQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  schemaVersionId?: string;
  moduleId?: string;
  parseStatus?: string;
}

function pageParams(query: PageQuery) {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 25));
  return { page, pageSize, offset: (page - 1) * pageSize };
}

@Injectable()
export class NerisSchemaRegistryService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async listPackages() {
    return this.db.select().from(nerisSchemaPackages).orderBy(asc(nerisSchemaPackages.code));
  }

  async listVersions(query: PageQuery = {}) {
    const { page, pageSize, offset } = pageParams(query);
    const where = query.schemaVersionId
      ? eq(nerisSchemaVersions.id, query.schemaVersionId)
      : undefined;
    const rows = await this.db
      .select()
      .from(nerisSchemaVersions)
      .where(where)
      .orderBy(desc(nerisSchemaVersions.createdAt))
      .limit(pageSize)
      .offset(offset);
    const totalRows = await this.db
      .select({ total: count() })
      .from(nerisSchemaVersions)
      .where(where);
    return { items: rows, page, pageSize, total: totalRows[0]?.total ?? 0 };
  }

  async getPublishedVersion() {
    const [row] = await this.db
      .select()
      .from(nerisSchemaVersions)
      .where(eq(nerisSchemaVersions.state, "PUBLISHED"))
      .orderBy(desc(nerisSchemaVersions.publishedAt))
      .limit(1);
    return row ?? null;
  }

  async listModules(query: PageQuery = {}) {
    const { page, pageSize, offset } = pageParams(query);
    const versionId = query.schemaVersionId ?? (await this.requirePublishedVersionId());
    const filters = [eq(nerisModules.schemaVersionId, versionId)];
    if (query.search) {
      filters.push(
        or(
          ilike(nerisModules.moduleKey, `%${query.search}%`),
          ilike(nerisModules.name, `%${query.search}%`),
          ilike(nerisModules.area, `%${query.search}%`),
        )!,
      );
    }
    const where = and(...filters);
    const items = await this.db
      .select()
      .from(nerisModules)
      .where(where)
      .orderBy(asc(nerisModules.ordinal))
      .limit(pageSize)
      .offset(offset);
    const totalRows = await this.db.select({ total: count() }).from(nerisModules).where(where);
    return { items, page, pageSize, total: totalRows[0]?.total ?? 0, schemaVersionId: versionId };
  }

  async listGroups(moduleId: string) {
    return this.db
      .select()
      .from(nerisModuleGroups)
      .where(eq(nerisModuleGroups.moduleId, moduleId))
      .orderBy(asc(nerisModuleGroups.ordinal));
  }

  async listFields(query: PageQuery = {}) {
    const { page, pageSize, offset } = pageParams(query);
    const versionId = query.schemaVersionId ?? (await this.requirePublishedVersionId());
    const filters = [eq(nerisFields.schemaVersionId, versionId)];
    if (query.moduleId) filters.push(eq(nerisFields.moduleId, query.moduleId));
    if (query.search) {
      filters.push(
        or(
          ilike(nerisFields.fieldKey, `%${query.search}%`),
          ilike(nerisFields.definition, `%${query.search}%`),
          ilike(nerisFields.valueSetLocation, `%${query.search}%`),
        )!,
      );
    }
    const where = and(...filters);
    const items = await this.db
      .select()
      .from(nerisFields)
      .where(where)
      .orderBy(asc(nerisFields.ordinal))
      .limit(pageSize)
      .offset(offset);
    const totalRows = await this.db.select({ total: count() }).from(nerisFields).where(where);
    return { items, page, pageSize, total: totalRows[0]?.total ?? 0, schemaVersionId: versionId };
  }

  async listConditions(query: PageQuery = {}) {
    const { page, pageSize, offset } = pageParams(query);
    const versionId = query.schemaVersionId ?? (await this.requirePublishedVersionId());
    const filters = [eq(nerisFields.schemaVersionId, versionId)];
    if (query.parseStatus) {
      filters.push(eq(nerisFieldConditions.parseStatus, query.parseStatus));
    }
    if (query.search) {
      filters.push(ilike(nerisFieldConditions.rawExpression, `%${query.search}%`));
    }
    const where = and(...filters);
    const items = await this.db
      .select({
        condition: nerisFieldConditions,
        fieldKey: nerisFields.fieldKey,
        moduleId: nerisFields.moduleId,
      })
      .from(nerisFieldConditions)
      .innerJoin(nerisFields, eq(nerisFieldConditions.fieldId, nerisFields.id))
      .where(where)
      .orderBy(asc(nerisFields.fieldKey))
      .limit(pageSize)
      .offset(offset);
    const totalRows = await this.db
      .select({ total: count() })
      .from(nerisFieldConditions)
      .innerJoin(nerisFields, eq(nerisFieldConditions.fieldId, nerisFields.id))
      .where(where);
    return { items, page, pageSize, total: totalRows[0]?.total ?? 0, schemaVersionId: versionId };
  }

  async listMappings(query: PageQuery = {}) {
    const { page, pageSize, offset } = pageParams(query);
    const versionId = query.schemaVersionId ?? (await this.requirePublishedVersionId());
    const filters = [eq(nerisFields.schemaVersionId, versionId)];
    if (query.search) {
      filters.push(
        or(
          ilike(nerisFieldMappings.mapApp, `%${query.search}%`),
          ilike(nerisFieldMappings.mapOrmLanding, `%${query.search}%`),
          ilike(nerisFields.fieldKey, `%${query.search}%`),
        )!,
      );
    }
    const where = and(...filters);
    const items = await this.db
      .select({
        mapping: nerisFieldMappings,
        fieldKey: nerisFields.fieldKey,
        moduleId: nerisFields.moduleId,
      })
      .from(nerisFieldMappings)
      .innerJoin(nerisFields, eq(nerisFieldMappings.fieldId, nerisFields.id))
      .where(where)
      .orderBy(asc(nerisFields.fieldKey))
      .limit(pageSize)
      .offset(offset);
    const totalRows = await this.db
      .select({ total: count() })
      .from(nerisFieldMappings)
      .innerJoin(nerisFields, eq(nerisFieldMappings.fieldId, nerisFields.id))
      .where(where);
    return { items, page, pageSize, total: totalRows[0]?.total ?? 0, schemaVersionId: versionId };
  }

  async listImportHistory(query: PageQuery = {}) {
    const { page, pageSize, offset } = pageParams(query);
    const items = await this.db
      .select()
      .from(nerisSchemaImportHistory)
      .orderBy(desc(nerisSchemaImportHistory.createdAt))
      .limit(pageSize)
      .offset(offset);
    const totalRows = await this.db.select({ total: count() }).from(nerisSchemaImportHistory);
    return { items, page, pageSize, total: totalRows[0]?.total ?? 0 };
  }

  async listValidationResults(query: PageQuery = {}) {
    const { page, pageSize, offset } = pageParams(query);
    const versionId = query.schemaVersionId ?? (await this.requirePublishedVersionId());
    const where = eq(nerisSchemaValidationResults.schemaVersionId, versionId);
    const items = await this.db
      .select()
      .from(nerisSchemaValidationResults)
      .where(where)
      .orderBy(asc(nerisSchemaValidationResults.severity), asc(nerisSchemaValidationResults.code))
      .limit(pageSize)
      .offset(offset);
    const totalRows = await this.db
      .select({ total: count() })
      .from(nerisSchemaValidationResults)
      .where(where);
    return { items, page, pageSize, total: totalRows[0]?.total ?? 0, schemaVersionId: versionId };
  }

  async integrityCounts(schemaVersionId?: string) {
    const versionId = schemaVersionId ?? (await this.requirePublishedVersionId());
    const moduleRows = await this.db
      .select({ modules: count() })
      .from(nerisModules)
      .where(eq(nerisModules.schemaVersionId, versionId));
    const fieldRows = await this.db
      .select({ fields: count() })
      .from(nerisFields)
      .where(eq(nerisFields.schemaVersionId, versionId));
    return {
      schemaVersionId: versionId,
      modules: moduleRows[0]?.modules ?? 0,
      fields: fieldRows[0]?.fields ?? 0,
    };
  }

  private async requirePublishedVersionId(): Promise<string> {
    const published = await this.getPublishedVersion();
    if (!published) {
      throw new ForgeError("NOT_FOUND", "No published NERIS schema version");
    }
    return published.id;
  }
}
