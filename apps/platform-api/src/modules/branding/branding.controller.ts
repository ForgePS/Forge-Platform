import { Body, Controller, Get, Param, Put, Req, Res } from "@nestjs/common";
import type { ForgePrincipal } from "@forge/tenant-context";
import type { Response } from "express";
import { ok } from "../../common/api-response.js";
import { setETag } from "../../common/concurrency.js";
import { Idempotent } from "../../common/idempotent.decorator.js";
import { getRequestIds, type RequestWithIds } from "../../common/request-ids.js";
import { Principal } from "../auth-context/principal.decorator.js";
import { RequirePermission } from "../auth-context/require-permission.decorator.js";
import { BrandingService } from "./branding.service.js";

@Controller("api/v1/tenants/:tenantId/branding")
export class BrandingController {
  constructor(private readonly branding: BrandingService) {}

  @Get()
  @RequirePermission("platform.configuration.update")
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

  @Put()
  @RequirePermission("platform.configuration.update")
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
}
