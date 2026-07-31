import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Inject, Injectable } from "@nestjs/common";
import type { ForgeEnvironment } from "@forge/environment";
import { createId } from "@forge/database";
import { APP_ENV } from "../../tokens.js";

const PRESIGN_EXPIRES_SECONDS = 15 * 60;

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

  buildStoredFilename(originalFilename: string): string {
    const basename = originalFilename.replace(/\\/g, "/").split("/").pop() ?? "file";
    const safe = basename
      .replace(/\.\.+/g, ".")
      .replace(/[^a-zA-Z0-9._-]+/g, "_")
      .replace(/^\.+/, "")
      .slice(0, 180);
    return `${createId()}-${safe || "file"}`;
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
}
