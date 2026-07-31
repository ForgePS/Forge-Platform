import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { getCadAdapter } from "@forge/cad-adapters";
import { CAD_AUDIT_ACTIONS } from "@forge/cad-contracts";
import {
  cadConnections,
  cadNormalizedEvents,
  cadRawMessages,
  createId,
  getSharedDatabase,
  withTenantTransaction,
} from "@forge/database";
import { createLogger } from "@forge/observability";
import { eq } from "drizzle-orm";

export type CadIntakeJob = {
  type: "cad.intake.normalize.v1";
  tenantId: string;
  connectionId: string;
  rawMessageId: string;
  correlationId: string;
  idempotencyKey: string;
};

export async function processCadIntakeJob(input: {
  job: CadIntakeJob;
  databaseUrl: string;
  region: string;
  documentBucket?: string;
  normalizationQueueUrl?: string;
}): Promise<"completed" | "failed"> {
  const logger = createLogger({
    service: "worker-service",
    environment: process.env.APP_ENV ?? "local",
  }).child({
    correlationId: input.job.correlationId,
  });

  const db = getSharedDatabase(input.databaseUrl);
  const s3 = new S3Client({ region: input.region });
  const sqs = new SQSClient({ region: input.region });

  try {
    await withTenantTransaction(db, input.job.tenantId, async (tx) => {
      const raw = await tx.query.cadRawMessages.findFirst({
        where: eq(cadRawMessages.id, input.job.rawMessageId),
      });
      if (!raw) {
        throw new Error("raw message not found");
      }
      if (raw.processingStatus === "NORMALIZED" || raw.processingStatus === "APPLIED") {
        return;
      }

      const connection = await tx.query.cadConnections.findFirst({
        where: eq(cadConnections.id, input.job.connectionId),
      });
      if (!connection) {
        throw new Error("connection not found");
      }

      const adapter = getCadAdapter(connection.adapterKey);
      if (!adapter) {
        throw new Error(`adapter not found: ${connection.adapterKey}`);
      }

      let payloadBytes: Uint8Array;
      if (raw.payloadStorageType === "INLINE_ENCRYPTED" && raw.inlinePayloadEncrypted) {
        payloadBytes = toPayloadBytes(raw.inlinePayloadEncrypted);
      } else if (raw.payloadS3Bucket && raw.payloadS3Key) {
        const obj = await s3.send(
          new GetObjectCommand({
            Bucket: raw.payloadS3Bucket,
            Key: raw.payloadS3Key,
          }),
        );
        const bytes = await obj.Body?.transformToByteArray();
        if (!bytes) {
          throw new Error("empty S3 payload");
        }
        payloadBytes = bytes;
      } else {
        throw new Error("payload unavailable");
      }

      await tx
        .update(cadRawMessages)
        .set({
          processingStatus: "NORMALIZING",
          currentProcessingStage: "NORMALIZATION",
          processingAttempts: (raw.processingAttempts ?? 0) + 1,
        })
        .where(eq(cadRawMessages.id, raw.id));

      const rawMessage: Parameters<NonNullable<typeof adapter>["parseRawMessage"]>[0] = {
        id: raw.id,
        tenantId: raw.tenantId,
        connectionId: raw.cadConnectionId,
        receivedAt: raw.receivedAt.toISOString(),
        transportType: "HTTPS_WEBHOOK",
        payloadStorageType: raw.payloadStorageType as "S3" | "INLINE_ENCRYPTED",
        payloadHash: raw.payloadHash,
      };
      if (raw.sourceMessageId) rawMessage.sourceMessageId = raw.sourceMessageId;
      if (raw.sourceIncidentId) rawMessage.sourceIncidentId = raw.sourceIncidentId;
      if (raw.sourceEventType) rawMessage.sourceEventType = raw.sourceEventType;
      if (raw.sourceVersion) rawMessage.sourceVersion = raw.sourceVersion;
      if (raw.sourceSequence != null) rawMessage.sourceSequence = raw.sourceSequence;
      if (raw.contentType) rawMessage.contentType = raw.contentType;
      if (raw.payloadS3Bucket) rawMessage.payloadS3Bucket = raw.payloadS3Bucket;
      if (raw.payloadS3Key) rawMessage.payloadS3Key = raw.payloadS3Key;
      if (raw.payloadSizeBytes != null) rawMessage.payloadSizeBytes = raw.payloadSizeBytes;

      const parsed = await adapter.parseRawMessage(rawMessage, payloadBytes);

      const normalized = await adapter.normalize(parsed, {
        tenantId: raw.tenantId,
        connectionId: raw.cadConnectionId,
        mappingProfileId: connection.mappingProfileId,
      });

      if (!normalized.ok || !normalized.event) {
        await tx
          .update(cadRawMessages)
          .set({
            processingStatus: "FAILED",
            lastProcessingErrorCode: "NORMALIZATION_FAILED",
            lastProcessingErrorSummary: normalized.errors.map((e) => e.code).join(",") || "failed",
          })
          .where(eq(cadRawMessages.id, raw.id));
        throw new Error("normalization failed");
      }

      const eventId = createId();
      await tx.insert(cadNormalizedEvents).values({
        id: eventId,
        tenantId: raw.tenantId,
        cadConnectionId: raw.cadConnectionId,
        cadRawMessageId: raw.id,
        adapterKey: connection.adapterKey,
        adapterVersion: connection.adapterVersion,
        mappingProfileId: connection.mappingProfileId,
        sourceMessageId: parsed.sourceMessageId ?? null,
        sourceIncidentId: parsed.sourceIncidentId ?? null,
        sourceIncidentNumber: normalized.event.source.incidentNumber ?? null,
        sourceEventId: parsed.sourceEventId ?? null,
        sourceSequence: parsed.sourceSequence ?? null,
        normalizedEventType: normalized.event.eventType,
        normalizedEventTimestamp: new Date(normalized.event.source.timestamp),
        originalEventTimestamp: normalized.event.source.timestamp,
        normalizedPayload: normalized.event as unknown as Record<string, unknown>,
        normalizationWarnings: normalized.warnings,
        normalizationErrors: normalized.errors,
        mappingStatus: "PENDING",
        incidentApplicationStatus: "PENDING",
      });

      await tx
        .update(cadRawMessages)
        .set({
          processingStatus: "NORMALIZED",
          currentProcessingStage: "NORMALIZATION",
          sourceIncidentId: parsed.sourceIncidentId ?? raw.sourceIncidentId,
          sourceEventType: parsed.sourceEventType ?? raw.sourceEventType,
          sourceSequence: parsed.sourceSequence ?? raw.sourceSequence,
        })
        .where(eq(cadRawMessages.id, raw.id));

      logger.info("cad message normalized", {
        action: CAD_AUDIT_ACTIONS.EVENT_NORMALIZED,
        eventId,
        eventType: normalized.event.eventType,
      });

      if (input.normalizationQueueUrl) {
        // Forward to matching queue in later increments; for 4B stop after normalize.
        await sqs.send(
          new SendMessageCommand({
            QueueUrl: input.normalizationQueueUrl,
            MessageBody: JSON.stringify({
              type: "cad.normalized.ready.v1",
              tenantId: raw.tenantId,
              connectionId: raw.cadConnectionId,
              rawMessageId: raw.id,
              normalizedEventId: eventId,
              correlationId: input.job.correlationId,
            }),
          }),
        );
      }
    });

    return "completed";
  } catch (error) {
    logger.error("cad intake processing failed", { error });
    return "failed";
  }
}

function toPayloadBytes(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return value;
  if (Buffer.isBuffer(value)) return new Uint8Array(value);
  if (typeof value === "string") {
    if (value.startsWith("\\x")) {
      return Buffer.from(value.slice(2), "hex");
    }
    return Buffer.from(value, "utf8");
  }
  throw new Error(`unsupported inline payload type: ${typeof value}`);
}
