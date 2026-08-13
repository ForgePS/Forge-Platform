import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
} from "@nestjs/common";
import type { ForgePrincipal } from "@forge/tenant-context";
import type { Response } from "express";
import { ok } from "../../common/api-response.js";
import { setETag } from "../../common/concurrency.js";
import { Idempotent } from "../../common/idempotent.decorator.js";
import { getRequestIds, type RequestWithIds } from "../../common/request-ids.js";
import { Principal } from "../auth-context/principal.decorator.js";
import { RequireAnyPermission } from "../auth-context/require-permission.decorator.js";
import { CommercialSubscriptionsService } from "./commercial-subscriptions.service.js";

@Controller()
export class CommercialSubscriptionsController {
  constructor(private readonly subscriptions: CommercialSubscriptionsService) {}

  @Get("api/v1/platform/commercial/subscriptions")
  @RequireAnyPermission(
    ["platform.subscription.view", "platform.entitlement.manage"],
    { allowWhenSuspended: true },
  )
  async listPlatform(@Req() req: RequestWithIds) {
    const data = await this.subscriptions.listPlatform();
    return ok(data, getRequestIds(req), { page: 1, pageSize: data.length, total: data.length });
  }

  @Get("api/v1/tenants/:tenantId/commercial/subscriptions")
  @RequireAnyPermission(
    ["platform.subscription.view", "platform.entitlement.manage"],
    { allowWhenSuspended: true },
  )
  async list(@Param("tenantId") tenantId: string, @Req() req: RequestWithIds) {
    const data = await this.subscriptions.list(tenantId);
    return ok(data, getRequestIds(req), { page: 1, pageSize: data.length, total: data.length });
  }

  @Get("api/v1/tenants/:tenantId/commercial/subscriptions/:id")
  @RequireAnyPermission(
    ["platform.subscription.view", "platform.entitlement.manage"],
    { allowWhenSuspended: true },
  )
  async detail(
    @Param("tenantId") tenantId: string,
    @Param("id") id: string,
    @Req() req: RequestWithIds,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = await this.subscriptions.getDetail(tenantId, id);
    setETag(res, data.subscription.recordVersion);
    return ok(data, getRequestIds(req));
  }

  @Post("api/v1/tenants/:tenantId/commercial/subscriptions")
  @RequireAnyPermission(
    ["platform.subscription.create", "platform.entitlement.manage"],
    { allowWhenSuspended: true },
  )
  @Idempotent({ resourceType: "commercial_subscription" })
  async create(
    @Param("tenantId") tenantId: string,
    @Body() body: unknown,
    @Principal() principal: ForgePrincipal,
    @Req() req: RequestWithIds,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = await this.subscriptions.create(tenantId, body, principal);
    setETag(res, data.recordVersion);
    return ok(data, getRequestIds(req));
  }

  @Post("api/v1/tenants/:tenantId/commercial/subscriptions/:id/activate")
  @RequireAnyPermission(
    ["platform.subscription.activate", "platform.entitlement.manage"],
    { allowWhenSuspended: true },
  )
  async activate(
    @Param("tenantId") tenantId: string,
    @Param("id") id: string,
    @Principal() principal: ForgePrincipal,
    @Req() req: RequestWithIds,
  ) {
    return ok(await this.subscriptions.activate(tenantId, id, principal), getRequestIds(req));
  }

  @Post("api/v1/tenants/:tenantId/commercial/subscriptions/:id/suspend")
  @RequireAnyPermission(
    ["platform.subscription.suspend", "platform.entitlement.manage"],
    { allowWhenSuspended: true },
  )
  async suspend(
    @Param("tenantId") tenantId: string,
    @Param("id") id: string,
    @Body() body: unknown,
    @Principal() principal: ForgePrincipal,
    @Req() req: RequestWithIds,
  ) {
    return ok(
      await this.subscriptions.suspend(tenantId, id, body, principal),
      getRequestIds(req),
    );
  }

  @Post("api/v1/tenants/:tenantId/commercial/subscriptions/:id/reactivate")
  @RequireAnyPermission(
    ["platform.subscription.activate", "platform.subscription.update", "platform.entitlement.manage"],
    { allowWhenSuspended: true },
  )
  async reactivate(
    @Param("tenantId") tenantId: string,
    @Param("id") id: string,
    @Principal() principal: ForgePrincipal,
    @Req() req: RequestWithIds,
  ) {
    return ok(await this.subscriptions.reactivate(tenantId, id, principal), getRequestIds(req));
  }

  @Post("api/v1/tenants/:tenantId/commercial/subscriptions/:id/cancel")
  @RequireAnyPermission(
    ["platform.subscription.cancel", "platform.entitlement.manage"],
    { allowWhenSuspended: true },
  )
  async cancel(
    @Param("tenantId") tenantId: string,
    @Param("id") id: string,
    @Body() body: unknown,
    @Principal() principal: ForgePrincipal,
    @Req() req: RequestWithIds,
  ) {
    return ok(
      await this.subscriptions.cancel(tenantId, id, body, principal),
      getRequestIds(req),
    );
  }

  @Post("api/v1/tenants/:tenantId/commercial/subscriptions/:id/renew")
  @RequireAnyPermission(
    ["platform.subscription.renew", "platform.entitlement.manage"],
    { allowWhenSuspended: true },
  )
  async renew(
    @Param("tenantId") tenantId: string,
    @Param("id") id: string,
    @Body() body: unknown,
    @Principal() principal: ForgePrincipal,
    @Req() req: RequestWithIds,
  ) {
    return ok(
      await this.subscriptions.renew(tenantId, id, body, principal),
      getRequestIds(req),
    );
  }

  @Post("api/v1/tenants/:tenantId/commercial/subscriptions/:id/items")
  @RequireAnyPermission(
    ["platform.subscription.update", "platform.entitlement.manage"],
    { allowWhenSuspended: true },
  )
  async addItem(
    @Param("tenantId") tenantId: string,
    @Param("id") id: string,
    @Body() body: unknown,
    @Query("preview") preview: string | undefined,
    @Principal() principal: ForgePrincipal,
    @Req() req: RequestWithIds,
  ) {
    const previewProration = preview === "1" || preview === "true";
    return ok(
      await this.subscriptions.addItem(tenantId, id, body, principal, { previewProration }),
      getRequestIds(req),
    );
  }

  @Post("api/v1/tenants/:tenantId/commercial/subscriptions/:id/preview-change")
  @RequireAnyPermission(
    ["platform.subscription.view", "platform.subscription.update", "platform.entitlement.manage"],
    { allowWhenSuspended: true },
  )
  async previewChange(
    @Param("tenantId") tenantId: string,
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() req: RequestWithIds,
  ) {
    return ok(await this.subscriptions.previewChange(tenantId, id, body), getRequestIds(req));
  }

  @Get("api/v1/tenants/:tenantId/commercial/subscriptions/:id/changes")
  @RequireAnyPermission(
    ["platform.subscription.view", "platform.entitlement.manage"],
    { allowWhenSuspended: true },
  )
  async changes(
    @Param("tenantId") tenantId: string,
    @Param("id") id: string,
    @Req() req: RequestWithIds,
  ) {
    return ok(await this.subscriptions.listChanges(tenantId, id), getRequestIds(req));
  }
}
