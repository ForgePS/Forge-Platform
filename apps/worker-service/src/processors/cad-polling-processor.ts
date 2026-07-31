import { createHash, randomUUID } from "node:crypto";
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { getCadAdapter } from "@forge/cad-adapters";
import { CAD_FEATURE_FLAGS } from "@forge/cad-contracts";
import {
  cadConnectionHealthLogs,
  cadConnections,
  cadRawMessages,
  createId,
  featureDefinitions,
  featureOverrides,
  getSharedDatabase,
  withTenantTransaction,
} from "@forge/database";
import { resolveFeatureValue } from "@forge/authorization";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { emitEmfMetric } from "../metrics.js";

export type CadPollingJob = {
  type: "cad.polling.tick.v1";
  correlationId?: string;
  tenantId?: string;
  tenantIds?: string[];
};

export async function processCadPollingTick(input: {
  job: CadPollingJob;
  databaseUrl: string;
  region: string;
  intakeQueueUrl: string;
  pollingTenantIds?: string[];
}): Promise<"completed"> {
  const db = getSharedDatabase(input.databaseUrl);
  const sqs = new SQSClient({ region: input.region });
  const correlationId = input.job.correlationId ?? randomUUID();

  const tenantIds = resolveTenantIds(input.job, input.pollingTenantIds);
  if (tenantIds.length === 0) {
    emitEmfMetric({
      dimensions: { Processor: "cad-polling" },
      metrics: { CadPollingSkippedNoTenant: 1 },
    });
    return "completed";
  }

  let messagesEnqueued = 0;
  for (const tenantId of tenantIds) {
    const pollingEnabled = await resolveFlag(db, tenantId, CAD_FEATURE_FLAGS.POLLING);
    const cadEnabled = await resolveFlag(db, tenantId, CAD_FEATURE_FLAGS.ENABLED);
    if (!cadEnabled || !pollingEnabled) {
      emitEmfMetric({
        dimensions: { Processor: "cad-polling", TenantId: tenantId.slice(0, 8) },
        metrics: { CadPollingSkippedFlag: 1 },
      });
      continue;
    }

    await withTenantTransaction(db, tenantId, async (tx) => {
      const connections = await tx
        .select()
        .from(cadConnections)
        .where(
          and(
            eq(cadConnections.tenantId, tenantId),
            inArray(cadConnections.status, ["ACTIVE", "TESTING", "DEGRADED"]),
            inArray(cadConnections.transportType, ["POLLING", "SYNTHETIC_SIMULATOR"]),
            isNull(cadConnections.archivedAt),
          ),
        );

      for (const connection of connections) {
        if (connection.environment === "PRODUCTION") continue;
        const adapter = getCadAdapter(connection.adapterKey);
        if (!adapter?.pollMessages) continue;

        const poll = await adapter.pollMessages(
          {
            tenantId,
            connectionId: connection.id,
            publicId: connection.publicId,
            adapterKey: connection.adapterKey,
            adapterVersion: connection.adapterVersion,
            environment: connection.environment,
            transportType: connection.transportType as "POLLING",
            configuration: (connection.configurationJson ?? {}) as Record<string, unknown>,
            credentialsSecretArn: connection.credentialsSecretArn,
            webhookSecretArn: connection.webhookSecretArn,
            webhookKeyId: connection.webhookKeyId,
          },
          {
            cursor: connection.pollingCursor,
            watermark: connection.pollingWatermark?.toISOString() ?? null,
          },
        );

        await tx.insert(cadConnectionHealthLogs).values({
          id: createId(),
          tenantId,
          cadConnectionId: connection.id,
          checkedAt: new Date(),
          healthStatus: poll.healthy ? "HEALTHY" : "DEGRADED",
          detail: poll.detail ?? null,
          source: "POLL",
          createdAt: new Date(),
        });

        for (const message of poll.messages) {
          const bodyBuf = Buffer.from(JSON.stringify(message.payload), "utf8");
          const payloadHash = createHash("sha256").update(bodyBuf).digest("hex");
          const rawMessageId = createId();
          const idempotencyKey = `poll:${connection.id}:${message.sourceMessageId}`;
          try {
            await tx.insert(cadRawMessages).values({
              id: rawMessageId,
              tenantId,
              cadConnectionId: connection.id,
              receivedAt: message.receivedAt ? new Date(message.receivedAt) : new Date(),
              transportType: connection.transportType,
              sourceMessageId: message.sourceMessageId,
              contentType: message.contentType ?? "application/json",
              payloadStorageType: "INLINE_ENCRYPTED",
              inlinePayloadEncrypted: bodyBuf,
              payloadHash,
              payloadSizeBytes: bodyBuf.byteLength,
              idempotencyKey,
              authenticationStatus: "VALID",
              signatureValid: true,
              processingStatus: "PERSISTED",
              acknowledgementStatus: "ACCEPTED",
              acknowledgedAt: new Date(),
              correlationId,
              createdAt: new Date(),
            });
          } catch {
            continue;
          }

          await sqs.send(
            new SendMessageCommand({
              QueueUrl: input.intakeQueueUrl,
              MessageBody: JSON.stringify({
                type: "cad.intake.normalize.v1",
                tenantId,
                connectionId: connection.id,
                rawMessageId,
                correlationId,
                idempotencyKey,
              }),
            }),
          );
          await tx
            .update(cadRawMessages)
            .set({ processingStatus: "QUEUED", currentProcessingStage: "INTAKE" })
            .where(eq(cadRawMessages.id, rawMessageId));
          messagesEnqueued += 1;
        }

        await tx
          .update(cadConnections)
          .set({
            pollingCursor: poll.nextCursor ?? connection.pollingCursor,
            pollingWatermark: poll.nextWatermark
              ? new Date(poll.nextWatermark)
              : connection.pollingWatermark,
            lastMessageAt: new Date(),
            lastSuccessAt: poll.healthy ? new Date() : connection.lastSuccessAt,
            healthStatus: poll.healthy ? "HEALTHY" : "DEGRADED",
            updatedAt: new Date(),
          })
          .where(eq(cadConnections.id, connection.id));
      }
    });
  }

  emitEmfMetric({
    dimensions: { Processor: "cad-polling" },
    metrics: { CadPollingMessagesEnqueued: messagesEnqueued, CadPollingTicksCompleted: 1 },
  });

  return "completed";
}

function resolveTenantIds(job: CadPollingJob, fromEnv?: string[]): string[] {
  if (job.tenantId) return [job.tenantId];
  if (job.tenantIds?.length) return job.tenantIds;
  return fromEnv ?? [];
}

async function resolveFlag(
  db: ReturnType<typeof getSharedDatabase>,
  tenantId: string,
  key: string,
): Promise<boolean> {
  return withTenantTransaction(db, tenantId, async (tx) => {
    const def = await tx.query.featureDefinitions.findFirst({
      where: eq(featureDefinitions.key, key),
    });
    if (!def) return false;
    const overrides = await tx.query.featureOverrides.findMany({
      where: and(
        eq(featureOverrides.tenantId, tenantId),
        eq(featureOverrides.featureDefinitionId, def.id),
        isNull(featureOverrides.organizationId),
        isNull(featureOverrides.userId),
      ),
    });
    return (
      resolveFeatureValue({
        tenant: overrides[0]?.valueJson as unknown,
        defaultValue: def.defaultValueJson as unknown,
      }) === true
    );
  });
}
