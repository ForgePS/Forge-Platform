/** Storage metadata manifest — list only, no downloads, no signed URLs. */
import { createWriteStream } from "node:fs";
import { Storage } from "@google-cloud/storage";
import { sha256File } from "./extract-firestore.js";

export type StorageManifestResult = {
  objectCount: number;
  totalBytes: number;
  outputFile: string;
  sha256: string;
  ownership: Record<string, number>;
};

export function inferOwnership(objectPath: string): {
  disposition: string;
  tenantMapping: string | null;
  relatedEntity: string | null;
} {
  const parts = objectPath.split("/");
  const top = parts[0] || "";
  if (top === "platform-billing-email-templates" || top === "platform-invoice-templates") {
    return { disposition: "PLATFORM_GLOBAL", tenantMapping: null, relatedEntity: "platform" };
  }
  // tenants/{businessId}/...
  if (top === "tenants" && parts[1]) {
    return {
      disposition: parts[1].startsWith("business-") ? "OWNERSHIP_CONFIRMED" : "AMBIGUOUS",
      tenantMapping: parts[1],
      relatedEntity: parts[3] || parts[2] || null,
    };
  }
  // module-attachments/{businessId}/...
  if (top === "module-attachments" && parts[1]) {
    return {
      disposition: parts[1].startsWith("business-") ? "OWNERSHIP_CONFIRMED" : "AMBIGUOUS",
      tenantMapping: parts[1],
      relatedEntity: parts[2] || null,
    };
  }
  if (
    (top === "dot-compliance" ||
      top === "certificates" ||
      top === "equipment-migrations" ||
      top === "training-imports" ||
      top === "dqf-exports") &&
    parts[1]
  ) {
    return {
      disposition: parts[1].startsWith("business-") ? "OWNERSHIP_CONFIRMED" : "AMBIGUOUS",
      tenantMapping: parts[1],
      relatedEntity: top,
    };
  }
  if (!top) return { disposition: "ORPHAN", tenantMapping: null, relatedEntity: null };
  return { disposition: "AMBIGUOUS", tenantMapping: null, relatedEntity: top };
}

export async function extractStorageManifest(
  projectId: string,
  bucketName: string,
  outputFile: string,
  extractRunId: string,
): Promise<StorageManifestResult> {
  const storage = new Storage({ projectId });
  const bucket = storage.bucket(bucketName);
  const stream = createWriteStream(outputFile, { flags: "w" });
  let objectCount = 0;
  let totalBytes = 0;
  const ownership: Record<string, number> = {};

  const write = (obj: unknown) =>
    new Promise<void>((resolve, reject) => {
      stream.write(`${JSON.stringify(obj)}\n`, (err) => (err ? reject(err) : resolve()));
    });

  for await (const file of bucket.getFilesStream({ autoPaginate: true })) {
    const objectPath = file.name || "";
    const size = Number(file.metadata?.size ?? 0);
    totalBytes += size;
    objectCount += 1;
    const own = inferOwnership(objectPath);
    ownership[own.disposition] = (ownership[own.disposition] ?? 0) + 1;

    await write({
      _migration: {
        sourceSystem: "FIREBASE_STORAGE",
        sourceProject: projectId,
        extractRunId,
        extractedAt: new Date().toISOString(),
      },
      data: {
        sourceBucket: bucketName,
        sourceObjectPath: objectPath,
        size,
        contentType: file.metadata?.contentType ?? null,
        generation: file.metadata?.generation ?? null,
        md5Hash: file.metadata?.md5Hash ?? null,
        crc32c: file.metadata?.crc32c ?? null,
        created: file.metadata?.timeCreated ?? null,
        updated: file.metadata?.updated ?? null,
        metadata: file.metadata?.metadata ?? null,
        tenantMapping: own.tenantMapping,
        relatedEntity: own.relatedEntity,
        relatedEntityId: null,
        migrationDisposition: own.disposition,
      },
    });
  }

  await new Promise<void>((resolve, reject) => {
    stream.end(() => resolve());
    stream.on("error", reject);
  });

  return {
    objectCount,
    totalBytes,
    outputFile,
    sha256: sha256File(outputFile),
    ownership,
  };
}
