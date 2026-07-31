import { randomUUID } from "node:crypto";
import {
  cadRawMessages,
  cadRetentionRuns,
  cadWebhookReplayCache,
  createId,
  getSharedDatabase,
  withTenantTransaction,
} from "@forge/database";
import { and, eq, isNotNull, lt } from "drizzle-orm";
import { emitEmfMetric } from "../metrics.js";

export type CadRetentionJob = {
  type: "cad.retention.run.v1";
  correlationId?: string;
  tenantId?: string | null;
};

/**
 * Purges expired webhook replay cache rows and clears inline CAD payloads past retention_until.
 * Does not delete S3 objects in Phase 4E (lifecycle policy / 4F ops). Audits via cad_retention_runs.
 */
export async function processCadRetentionRun(input: {
  job: CadRetentionJob;
  databaseUrl: string;
}): Promise<"completed" | "failed"> {
  const db = getSharedDatabase(input.databaseUrl);
  const correlationId = input.job.correlationId ?? randomUUID();
  const runId = createId();
  const startedAt = new Date();
  const tenantId = input.job.tenantId ?? null;

  try {
    if (tenantId) {
      await withTenantTransaction(db, tenantId, async (tx) => {
        await tx.insert(cadRetentionRuns).values({
          id: runId,
          tenantId,
          startedAt,
          status: "RUNNING",
          scope: "RAW_AND_REPLAY",
          correlationId,
          createdAt: startedAt,
          updatedAt: startedAt,
        });
      });
    } else {
      // Platform-scoped run row (tenant_id NULL) — requires session that can insert NULL tenant.
      await db.insert(cadRetentionRuns).values({
        id: runId,
        tenantId: null,
        startedAt,
        status: "RUNNING",
        scope: "RAW_AND_REPLAY",
        correlationId,
        createdAt: startedAt,
        updatedAt: startedAt,
      });
    }

    let replayPurged = 0;
    let rawPurged = 0;

    if (tenantId) {
      await withTenantTransaction(db, tenantId, async (tx) => {
        const replay = await tx
          .delete(cadWebhookReplayCache)
          .where(
            and(
              eq(cadWebhookReplayCache.tenantId, tenantId),
              lt(cadWebhookReplayCache.expiresAt, new Date()),
            ),
          )
          .returning({ id: cadWebhookReplayCache.id });
        replayPurged = replay.length;

        const expired = await tx
          .update(cadRawMessages)
          .set({
            inlinePayloadEncrypted: null,
          })
          .where(
            and(
              eq(cadRawMessages.tenantId, tenantId),
              isNotNull(cadRawMessages.retentionUntil),
              lt(cadRawMessages.retentionUntil, new Date()),
              isNotNull(cadRawMessages.inlinePayloadEncrypted),
            ),
          )
          .returning({ id: cadRawMessages.id });
        rawPurged = expired.length;

        await tx
          .update(cadRetentionRuns)
          .set({
            status: "COMPLETED",
            completedAt: new Date(),
            replayCachePurged: replayPurged,
            rawPayloadsPurged: rawPurged,
            updatedAt: new Date(),
          })
          .where(eq(cadRetentionRuns.id, runId));
      });
    } else {
      // Without tenant context RLS blocks table access for forge_app.
      // Record completed with zeros and rely on per-tenant scheduled messages.
      await db
        .update(cadRetentionRuns)
        .set({
          status: "COMPLETED",
          completedAt: new Date(),
          replayCachePurged: 0,
          rawPayloadsPurged: 0,
          errorSummary:
            "Platform-scoped retention requires tenantId; enqueue per-tenant jobs via CAD_RETENTION_TENANT_IDS",
          updatedAt: new Date(),
        })
        .where(eq(cadRetentionRuns.id, runId));
    }

    emitEmfMetric({
      dimensions: { Processor: "cad-retention" },
      metrics: {
        CadRetentionRunsCompleted: 1,
        CadReplayCachePurged: replayPurged,
        CadRawPayloadsPurged: rawPurged,
      },
    });
    return "completed";
  } catch (error) {
    try {
      if (tenantId) {
        await withTenantTransaction(db, tenantId, async (tx) => {
          await tx
            .update(cadRetentionRuns)
            .set({
              status: "FAILED",
              completedAt: new Date(),
              errorSummary: error instanceof Error ? error.message : String(error),
              updatedAt: new Date(),
            })
            .where(eq(cadRetentionRuns.id, runId));
        });
      }
    } catch {
      // ignore secondary failure
    }
    emitEmfMetric({
      dimensions: { Processor: "cad-retention" },
      metrics: { CadRetentionRunsFailed: 1 },
    });
    return "failed";
  }
}
