import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  StreamableFile,
} from "@nestjs/common";
import type { ForgePrincipal } from "@forge/tenant-context";
import type { Response } from "express";
import { Readable } from "node:stream";
import { ok } from "../../common/api-response.js";
import { setETag } from "../../common/concurrency.js";
import { Idempotent } from "../../common/idempotent.decorator.js";
import { getRequestIds, type RequestWithIds } from "../../common/request-ids.js";
import { Principal } from "../auth-context/principal.decorator.js";
import { Public } from "../auth-context/public.decorator.js";
import { RequireAnyPermission } from "../auth-context/require-permission.decorator.js";
import { BrandingAssetsService } from "./branding-assets.service.js";
import { BrandingService } from "./branding.service.js";
import { LoginBrandingService } from "./login-branding.service.js";

@Controller()
export class BrandingController {
  constructor(
    private readonly branding: BrandingService,
    private readonly assets: BrandingAssetsService,
    private readonly loginBranding: LoginBrandingService,
  ) {}

  /** Pre-auth Sign-in branding resolved by vanity hostname → tenant_domains. */
  @Get("api/v1/public/login-branding")
  @Public()
  @Header("Cache-Control", "public, max-age=60")
  async loginBrandingByHost(
    @Query("host") host: string | undefined,
    @Req() req: RequestWithIds,
  ) {
    const data = await this.loginBranding.byHost(host);
    return ok(data, getRequestIds(req));
  }

  @Get("api/v1/tenants/:tenantId/branding")
  @RequireAnyPermission(["platform.configuration.update", "tenant.configuration.update"])
  async get(
    @Param("tenantId") tenantId: string,
    @Req() req: RequestWithIds,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = await this.branding.get(tenantId);
    if (data) {
      setETag(res, data.recordVersion);
    }
    return ok(data, getRequestIds(req));
  }

  @Put("api/v1/tenants/:tenantId/branding")
  @RequireAnyPermission(["platform.configuration.update", "tenant.configuration.update"])
  @Idempotent({ resourceType: "branding" })
  async put(
    @Param("tenantId") tenantId: string,
    @Body() body: unknown,
    @Principal() principal: ForgePrincipal,
    @Req() req: RequestWithIds,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = await this.branding.put(tenantId, body, principal);
    setETag(res, data.recordVersion);
    return ok(data, getRequestIds(req));
  }

  /** Small JSON init — browser then PUTs bytes to S3 (WAF-safe). */
  @Post("api/v1/tenants/:tenantId/branding/assets/uploads")
  @RequireAnyPermission(["platform.configuration.update", "tenant.configuration.update"])
  @Idempotent({ resourceType: "branding_asset_upload" })
  async createUpload(
    @Param("tenantId") tenantId: string,
    @Body() body: unknown,
    @Req() req: RequestWithIds,
  ) {
    const data = await this.assets.createUpload(tenantId, body);
    return ok(data, getRequestIds(req));
  }

  @Get("api/v1/branding-assets/:tenantId/:assetId")
  @Public()
  @Header("Cache-Control", "public, max-age=86400")
  async serveAsset(
    @Param("tenantId") tenantId: string,
    @Param("assetId") assetId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const object = await this.assets.getObject(tenantId, assetId);
    res.setHeader("Content-Type", object.contentType);
    if (object.contentLength !== undefined) {
      res.setHeader("Content-Length", String(object.contentLength));
    }
    const stream =
      object.body instanceof Readable ? object.body : Readable.from(object.body as never);
    return new StreamableFile(stream);
  }
}
