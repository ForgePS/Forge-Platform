import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Inject, Injectable } from "@nestjs/common";
import {
  brandingObjectKeyPrefix,
  isSignedAccessExpired,
  objectKeyBelongsToTenant,
} from "@forge/contracts";
import type { ForgeEnvironment } from "@forge/environment";
import { createId } from "@forge/database";
import { ForgeError } from "@forge/errors";
import { APP_ENV } from "../../tokens.js";

export const PRESIGN_EXPIRES_SECONDS = 15 * 60;

@Injectable()
export class DocumentStorageService {
  private readonly client: S3Client;

  constructor(@Inject(APP_ENV) private readonly env: ForgeEnvironment) {
    this.client = new S3Client({ region: this.env.AWS_REGION });
  }

  get bucketName(): string {
    return this.env.S3_DOCUMENT_BUCKET;
  }

  /** Tenant-scoped object key — never public. */
  buildObjectKey(tenantId: string, incidentId: string, storedFilename: string): string {
    return `tenants/${tenantId}/incidents/${incidentId}/documents/${storedFilename}`;
  }

  /** Branding asset key (MK-S14). */
  buildBrandingObjectKey(tenantId: string, kind: "logo" | "icon", storedFilename: string): string {
    return `${brandingObjectKeyPrefix(tenantId)}${kind}/${storedFilename}`;
  }

  buildStoredFilename(originalFilename: string): string {
    const basename = originalFilename.replace(/\\/g, "/").split("/").pop() ?? "file";
    const safe = basename
      .replace(/\.\.+/g, ".")
      .replace(/[^a-zA-Z0-9._-]+/g, "_")
      .replace(/^\.+/, "")
      .slice(0, 180);
    return `${createId()}-${safe || "file"}`;
  }

  assertTenantObjectKey(objectKey: string, tenantId: string): void {
    if (!objectKeyBelongsToTenant(objectKey, tenantId)) {
      throw new ForgeError("FORBIDDEN", "Object key does not belong to the requested tenant");
    }
  }

  assertDownloadNotExpired(expiresAt: Date | string, now: Date = new Date()): void {
    if (isSignedAccessExpired(expiresAt, now)) {
      throw new ForgeError("VALIDATION_FAILED", "Signed access has expired");
    }
  }

  async createPresignedUploadUrl(input: {
    objectKey: string;
    mimeType: string;
    contentLength: number;
  }): Promise<{ uploadUrl: string; expiresInSeconds: number; mode: "S3_PRESIGNED" }> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: input.objectKey,
      ContentType: input.mimeType,
      ContentLength: input.contentLength,
      ServerSideEncryption: "aws:kms",
    });
    const uploadUrl = await getSignedUrl(this.client, command, {
      expiresIn: PRESIGN_EXPIRES_SECONDS,
    });
    return {
      uploadUrl,
      expiresInSeconds: PRESIGN_EXPIRES_SECONDS,
      mode: "S3_PRESIGNED",
    };
  }

  async createPresignedDownloadUrl(input: {
    objectKey: string;
    mimeType?: string;
    filename?: string;
  }): Promise<{
    downloadUrl: string;
    expiresInSeconds: number;
    expiresAt: string;
    mode: "S3_PRESIGNED";
  }> {
    const expiresAt = new Date(Date.now() + PRESIGN_EXPIRES_SECONDS * 1000);
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: input.objectKey,
      ...(input.mimeType ? { ResponseContentType: input.mimeType } : {}),
      ...(input.filename
        ? { ResponseContentDisposition: `inline; filename="${input.filename}"` }
        : {}),
    });
    const downloadUrl = await getSignedUrl(this.client, command, {
      expiresIn: PRESIGN_EXPIRES_SECONDS,
    });
    return {
      downloadUrl,
      expiresInSeconds: PRESIGN_EXPIRES_SECONDS,
      expiresAt: expiresAt.toISOString(),
      mode: "S3_PRESIGNED",
    };
  }
}
