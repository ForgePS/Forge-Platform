import { Body, Controller, Get, Param, Patch, Post, Req } from "@nestjs/common";
import type { ForgePrincipal } from "@forge/tenant-context";
import { ok } from "../../common/api-response.js";
import { Idempotent } from "../../common/idempotent.decorator.js";
import { getRequestIds, type RequestWithIds } from "../../common/request-ids.js";
import { Principal } from "../auth-context/principal.decorator.js";
import { RequireAnyPermission } from "../auth-context/require-permission.decorator.js";
import { PlansService } from "./plans.service.js";

@Controller("api/v1/platform/plans")
export class PlansController {
  constructor(private readonly plans: PlansService) {}

  @Get()
  @RequireAnyPermission(
    ["platform.plan.view", "platform.entitlement.manage", "platform.subscription.view"],
    { allowWhenSuspended: true },
  )
  async list(@Req() req: RequestWithIds) {
    const data = await this.plans.list();
    return ok(data, getRequestIds(req), { page: 1, pageSize: data.length, total: data.length });
  }

  @Get(":planId")
  @RequireAnyPermission(
    ["platform.plan.view", "platform.entitlement.manage", "platform.subscription.view"],
    { allowWhenSuspended: true },
  )
  async get(@Param("planId") planId: string, @Req() req: RequestWithIds) {
    return ok(await this.plans.getById(planId), getRequestIds(req));
  }

  @Post()
  @RequireAnyPermission(["platform.plan.manage", "platform.entitlement.manage"], {
    allowWhenSuspended: true,
  })
  @Idempotent({ resourceType: "subscription_plan" })
  async create(
    @Body() body: unknown,
    @Principal() principal: ForgePrincipal,
    @Req() req: RequestWithIds,
  ) {
    return ok(await this.plans.create(body, principal), getRequestIds(req));
  }

  @Patch(":planId")
  @RequireAnyPermission(["platform.plan.manage", "platform.entitlement.manage"], {
    allowWhenSuspended: true,
  })
  async patch(
    @Param("planId") planId: string,
    @Body() body: unknown,
    @Principal() principal: ForgePrincipal,
    @Req() req: RequestWithIds,
  ) {
    return ok(await this.plans.patch(planId, body, principal), getRequestIds(req));
  }

  @Post(":planId/versions")
  @RequireAnyPermission(["platform.plan.manage", "platform.entitlement.manage"], {
    allowWhenSuspended: true,
  })
  @Idempotent({ resourceType: "subscription_plan_version" })
  async createVersion(
    @Param("planId") planId: string,
    @Body() body: unknown,
    @Principal() principal: ForgePrincipal,
    @Req() req: RequestWithIds,
  ) {
    return ok(await this.plans.createVersion(planId, body, principal), getRequestIds(req));
  }
}
