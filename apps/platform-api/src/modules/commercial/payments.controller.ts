import { Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import type { ForgePrincipal } from "@forge/tenant-context";
import { ok } from "../../common/api-response.js";
import { Idempotent } from "../../common/idempotent.decorator.js";
import { getRequestIds, type RequestWithIds } from "../../common/request-ids.js";
import { Principal } from "../auth-context/principal.decorator.js";
import { RequireAnyPermission } from "../auth-context/require-permission.decorator.js";
import { PaymentsService } from "./payments.service.js";

@Controller("api/v1/tenants/:tenantId/commercial/payments")
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get()
  @RequireAnyPermission(
    ["platform.payment.view", "platform.billing.view", "platform.entitlement.manage"],
    { allowWhenSuspended: true },
  )
  async list(@Param("tenantId") tenantId: string, @Req() req: RequestWithIds) {
    const data = await this.payments.list(tenantId);
    return ok(data, getRequestIds(req), { page: 1, pageSize: data.length, total: data.length });
  }

  @Post()
  @RequireAnyPermission(
    ["platform.payment.record", "platform.entitlement.manage"],
    { allowWhenSuspended: true },
  )
  @Idempotent({ resourceType: "payment" })
  async record(
    @Param("tenantId") tenantId: string,
    @Body() body: unknown,
    @Principal() principal: ForgePrincipal,
    @Req() req: RequestWithIds,
  ) {
    return ok(await this.payments.record(tenantId, body, principal), getRequestIds(req));
  }

  @Post(":paymentId/allocate")
  @RequireAnyPermission(
    ["platform.payment.record", "platform.entitlement.manage"],
    { allowWhenSuspended: true },
  )
  async allocate(
    @Param("tenantId") tenantId: string,
    @Param("paymentId") paymentId: string,
    @Body() body: unknown,
    @Principal() principal: ForgePrincipal,
    @Req() req: RequestWithIds,
  ) {
    return ok(
      await this.payments.allocate(tenantId, paymentId, body, principal),
      getRequestIds(req),
    );
  }
}
