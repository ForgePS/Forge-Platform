import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Inject, Injectable } from "@nestjs/common";
import { createId } from "@forge/database";
import type { ForgeEnvironment } from "@forge/environment";
import { ForgeError } from "@forge/errors";
import { z } from "zod";
import { APP_ENV } from "../../tokens.js";

const PRESIGN_EXPIRES_SECONDS = 15 * 60;
const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
  "image/gif",
]);

const initSchema = z.object({
  filename: z.string().min(1).max(200),
  mimeType: z.string().min(1).max(100),
  fileSizeBytes: z.number().int().positive().max(MAX_BYTES),
});

@Injectable()
export class BrandingAssetsService {
  private readonly client: S3Client;

  constructor(@Inject(APP_ENV) private readonly env: ForgeEnvironment) {
    this.client = new S3Client({ region: this.env.AWS_REGION });
  }

  get bucketName(): string {
    return this.env.S3_DOCUMENT_BUCKET;
  }

  buildObjectKey(tenantId: string, assetId: string): string {
    return `tenants/${tenantId}/branding-assets/${assetId}`;
  }

  publicAssetUrl(tenantId: string, assetId: string): string {
    const base = this.env.PUBLIC_API_URL.replace(/\/$/, "");
    return `${base}/api/v1/branding-assets/${tenantId}/${assetId}`;
  }

  /**
   * Tiny JSON init (avoids WAF SizeRestrictions_BODY on ALB) + browser PUT to S3.
   */
  async createUpload(tenantId: string, input: unknown): Promise<{
    assetId: string;
    url: string;
    uploadUrl: string;
    expiresInSeconds: number;
    requiredHeaders: Record<string, string>;
  }> {
    const data = initSchema.parse(input);
    const mimeType = data.mimeType.toLowerCase().trim();
    if (!ALLOWED_MIME.has(mimeType)) {
      throw new ForgeError(
        "VALIDATION_FAILED",
        "Only PNG, JPEG, WebP, GIF, and SVG images are allowed",
      );
    }

    const assetId = createId();
    const objectKey = this.buildObjectKey(tenantId, assetId);
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: objectKey,
      ContentType: mimeType,
      ContentLength: data.fileSizeBytes,
      ServerSideEncryption: "aws:kms",
    });
    const uploadUrl = await getSignedUrl(this.client, command, {
      expiresIn: PRESIGN_EXPIRES_SECONDS,
    });

    return {
      assetId,
      url: this.publicAssetUrl(tenantId, assetId),
      uploadUrl,
      expiresInSeconds: PRESIGN_EXPIRES_SECONDS,
      requiredHeaders: {
        "Content-Type": mimeType,
        "x-amz-server-side-encryption": "aws:kms",
      },
    };
  }

  async getObject(tenantId: string, assetId: string): Promise<{
    body: NodeJS.ReadableStream;
    contentType: string;
    contentLength?: number;
  }> {
    if (!z.string().uuid().safeParse(assetId).success) {
      throw new ForgeError("NOT_FOUND", "Asset not found");
    }
    if (!z.string().uuid().safeParse(tenantId).success) {
      throw new ForgeError("NOT_FOUND", "Asset not found");
    }

    try {
      const result = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucketName,
          Key: this.buildObjectKey(tenantId, assetId),
        }),
      );
      if (!result.Body) {
        throw new ForgeError("NOT_FOUND", "Asset not found");
      }
      return {
        body: result.Body as NodeJS.ReadableStream,
        contentType: result.ContentType || "application/octet-stream",
        ...(typeof result.ContentLength === "number"
          ? { contentLength: result.ContentLength }
          : {}),
      };
    } catch (error) {
      if (error instanceof ForgeError) throw error;
      throw new ForgeError("NOT_FOUND", "Asset not found");
    }
  }
}

