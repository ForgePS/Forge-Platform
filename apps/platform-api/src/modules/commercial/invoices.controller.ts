import { Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import type { ForgePrincipal } from "@forge/tenant-context";
import { ok } from "../../common/api-response.js";
import { Idempotent } from "../../common/idempotent.decorator.js";
import { getRequestIds, type RequestWithIds } from "../../common/request-ids.js";
import { Principal } from "../auth-context/principal.decorator.js";
import { RequireAnyPermission } from "../auth-context/require-permission.decorator.js";
import { InvoicesService } from "./invoices.service.js";

@Controller("api/v1/tenants/:tenantId/commercial/invoices")
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Get()
  @RequireAnyPermission(
    ["platform.billing.view", "platform.entitlement.manage"],
    { allowWhenSuspended: true },
  )
  async list(@Param("tenantId") tenantId: string, @Req() req: RequestWithIds) {
    const data = await this.invoices.list(tenantId);
    return ok(data, getRequestIds(req), { page: 1, pageSize: data.length, total: data.length });
  }

  @Get(":invoiceId")
  @RequireAnyPermission(
    ["platform.billing.view", "platform.entitlement.manage"],
    { allowWhenSuspended: true },
  )
  async detail(
    @Param("tenantId") tenantId: string,
    @Param("invoiceId") invoiceId: string,
    @Req() req: RequestWithIds,
  ) {
    return ok(await this.invoices.getDetail(tenantId, invoiceId), getRequestIds(req));
  }

  @Post()
  @RequireAnyPermission(
    ["platform.invoice.create", "platform.entitlement.manage"],
    { allowWhenSuspended: true },
  )
  @Idempotent({ resourceType: "invoice" })
  async create(
    @Param("tenantId") tenantId: string,
    @Body() body: unknown,
    @Principal() principal: ForgePrincipal,
    @Req() req: RequestWithIds,
  ) {
    return ok(await this.invoices.create(tenantId, body, principal), getRequestIds(req));
  }

  @Post("from-subscription/:subscriptionId")
  @RequireAnyPermission(
    ["platform.invoice.create", "platform.entitlement.manage"],
    { allowWhenSuspended: true },
  )
  @Idempotent({ resourceType: "invoice" })
  async generate(
    @Param("tenantId") tenantId: string,
    @Param("subscriptionId") subscriptionId: string,
    @Principal() principal: ForgePrincipal,
    @Req() req: RequestWithIds,
  ) {
    return ok(
      await this.invoices.generateFromSubscription(tenantId, subscriptionId, principal),
      getRequestIds(req),
    );
  }

  @Post(":invoiceId/finalize")
  @RequireAnyPermission(
    ["platform.invoice.update", "platform.entitlement.manage"],
    { allowWhenSuspended: true },
  )
  async finalize(
    @Param("tenantId") tenantId: string,
    @Param("invoiceId") invoiceId: string,
    @Body() body: unknown,
    @Principal() principal: ForgePrincipal,
    @Req() req: RequestWithIds,
  ) {
    return ok(
      await this.invoices.finalize(tenantId, invoiceId, body, principal),
      getRequestIds(req),
    );
  }

  @Post(":invoiceId/void")
  @RequireAnyPermission(
    ["platform.invoice.void", "platform.entitlement.manage"],
    { allowWhenSuspended: true },
  )
  async voidInvoice(
    @Param("tenantId") tenantId: string,
    @Param("invoiceId") invoiceId: string,
    @Principal() principal: ForgePrincipal,
    @Req() req: RequestWithIds,
  ) {
    return ok(await this.invoices.voidInvoice(tenantId, invoiceId, principal), getRequestIds(req));
  }
}
