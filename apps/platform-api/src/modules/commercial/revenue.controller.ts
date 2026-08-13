import { Controller, Get, Query, Req } from "@nestjs/common";
import { ok } from "../../common/api-response.js";
import { getRequestIds, type RequestWithIds } from "../../common/request-ids.js";
import { RequireAnyPermission } from "../auth-context/require-permission.decorator.js";
import { RevenueService } from "./revenue.service.js";

@Controller("api/v1/platform/commercial/analytics")
export class RevenueController {
  constructor(private readonly revenue: RevenueService) {}

  @Get("summary")
  @RequireAnyPermission(
    ["platform.revenue.view", "platform.entitlement.manage"],
    { allowWhenSuspended: true },
  )
  async summary(@Req() req: RequestWithIds) {
    return ok(await this.revenue.summary(), getRequestIds(req));
  }

  @Get("renewals")
  @RequireAnyPermission(
    ["platform.revenue.view", "platform.subscription.view", "platform.entitlement.manage"],
    { allowWhenSuspended: true },
  )
  async renewals(
    @Query() query: Record<string, string>,
    @Req() req: RequestWithIds,
  ) {
    const data = await this.revenue.renewals(query);
    return ok(data, getRequestIds(req), { page: 1, pageSize: data.length, total: data.length });
  }
}
