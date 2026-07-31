import { Controller, Headers, Param, Post, Req, Res } from "@nestjs/common";
import type { Response } from "express";
import { getRequestIds, type RequestWithIds } from "../../common/request-ids.js";
import { Public } from "../auth-context/public.decorator.js";
import { CadWebhookService } from "./cad-webhook.service.js";

@Controller("api/v1/cad/webhooks")
export class CadWebhookController {
  constructor(private readonly webhooks: CadWebhookService) {}

  @Post(":connectionPublicId")
  @Public()
  async ingest(
    @Param("connectionPublicId") connectionPublicId: string,
    @Headers() headers: Record<string, string | undefined>,
    @Req() req: RequestWithIds & { rawBody?: Buffer; body?: unknown },
    @Res({ passthrough: false }) res: Response,
  ): Promise<void> {
    const ids = getRequestIds(req);
    const rawBody = resolveRawBody(req);
    const contentType = headers["content-type"] ?? headers["Content-Type"];
    const ingestInput: {
      connectionPublicId: string;
      headers: Record<string, string | undefined>;
      rawBody: Buffer;
      correlationId: string;
      requestId: string;
      contentType?: string;
      remoteAddress?: string;
    } = {
      connectionPublicId,
      headers,
      rawBody,
      correlationId: ids.correlationId,
      requestId: ids.requestId,
    };
    if (contentType) ingestInput.contentType = contentType;
    if (req.ip) ingestInput.remoteAddress = req.ip;
    const result = await this.webhooks.ingest(ingestInput);
    res.status(result.httpStatus).json(result.body);
  }
}

function resolveRawBody(req: { rawBody?: Buffer; body?: unknown }): Buffer {
  if (req.rawBody && Buffer.isBuffer(req.rawBody)) {
    return req.rawBody;
  }
  if (typeof req.body === "string") {
    return Buffer.from(req.body, "utf8");
  }
  if (Buffer.isBuffer(req.body)) {
    return req.body;
  }
  if (req.body !== undefined && req.body !== null) {
    return Buffer.from(JSON.stringify(req.body), "utf8");
  }
  return Buffer.alloc(0);
}
