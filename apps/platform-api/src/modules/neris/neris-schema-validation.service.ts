import { Inject, Injectable } from "@nestjs/common";
import { NERIS_EXPECTED_COUNTS } from "@forge/neris";
import {
  nerisFields,
  nerisModules,
  nerisSchemaValidationResults,
  nerisSchemaVersions,
  nerisValueOptions,
  nerisValueSets,
  type Database,
} from "@forge/database";
import { ForgeError } from "@forge/errors";
import { count, desc, eq } from "drizzle-orm";
import { DATABASE } from "../../tokens.js";

@Injectable()
export class NerisSchemaValidationService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async getLatestResults(schemaVersionId?: string) {
    const versionId = schemaVersionId ?? (await this.requirePublishedVersionId());
    const items = await this.db
      .select()
      .from(nerisSchemaValidationResults)
      .where(eq(nerisSchemaValidationResults.schemaVersionId, versionId))
      .orderBy(nerisSchemaValidationResults.severity);
    return { schemaVersionId: versionId, items };
  }

  async runLiveIntegrityCheck(schemaVersionId?: string) {
    const versionId = schemaVersionId ?? (await this.requirePublishedVersionId());
    const moduleRows = await this.db
      .select({ modules: count() })
      .from(nerisModules)
      .where(eq(nerisModules.schemaVersionId, versionId));
    const fieldRows = await this.db
      .select({ fields: count() })
      .from(nerisFields)
      .where(eq(nerisFields.schemaVersionId, versionId));
    const valueSetRows = await this.db
      .select({ valueSets: count() })
      .from(nerisValueSets)
      .where(eq(nerisValueSets.schemaVersionId, versionId));
    const optionRows = await this.db
      .select({ options: count() })
      .from(nerisValueOptions)
      .innerJoin(nerisValueSets, eq(nerisValueOptions.valueSetId, nerisValueSets.id))
      .where(eq(nerisValueSets.schemaVersionId, versionId));
    const modules = moduleRows[0]?.modules ?? 0;
    const fields = fieldRows[0]?.fields ?? 0;
    const valueSets = valueSetRows[0]?.valueSets ?? 0;
    const options = optionRows[0]?.options ?? 0;

    const issues: Array<{ code: string; severity: string; message: string }> = [];
    if (modules !== NERIS_EXPECTED_COUNTS.modules) {
      issues.push({
        code: "MODULE_COUNT_MISMATCH",
        severity: "ERROR",
        message: `Expected ${NERIS_EXPECTED_COUNTS.modules}, found ${modules}`,
      });
    }
    if (fields !== NERIS_EXPECTED_COUNTS.fields) {
      issues.push({
        code: "FIELD_COUNT_MISMATCH",
        severity: "ERROR",
        message: `Expected ${NERIS_EXPECTED_COUNTS.fields}, found ${fields}`,
      });
    }
    if (valueSets !== NERIS_EXPECTED_COUNTS.valueSets) {
      issues.push({
        code: "VALUE_SET_COUNT_MISMATCH",
        severity: "ERROR",
        message: `Expected ${NERIS_EXPECTED_COUNTS.valueSets}, found ${valueSets}`,
      });
    }
    if (options !== NERIS_EXPECTED_COUNTS.options) {
      issues.push({
        code: "OPTION_COUNT_MISMATCH",
        severity: "ERROR",
        message: `Expected ${NERIS_EXPECTED_COUNTS.options}, found ${options}`,
      });
    }

    return {
      schemaVersionId: versionId,
      counts: { modules, fields, valueSets, options },
      expected: NERIS_EXPECTED_COUNTS,
      ok: issues.length === 0,
      issues,
    };
  }

  private async requirePublishedVersionId(): Promise<string> {
    const [row] = await this.db
      .select()
      .from(nerisSchemaVersions)
      .where(eq(nerisSchemaVersions.state, "PUBLISHED"))
      .orderBy(desc(nerisSchemaVersions.publishedAt))
      .limit(1);
    if (!row) throw new ForgeError("NOT_FOUND", "No published NERIS schema version");
    return row.id;
  }
}
