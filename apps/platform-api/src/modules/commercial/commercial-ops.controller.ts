import { Body, Controller, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import type { ForgePrincipal } from "@forge/tenant-context";
import { ok } from "../../common/api-response.js";
import { Idempotent } from "../../common/idempotent.decorator.js";
import { getRequestIds, type RequestWithIds } from "../../common/request-ids.js";
import { Principal } from "../auth-context/principal.decorator.js";
import { RequireAnyPermission } from "../auth-context/require-permission.decorator.js";
import { ContractsService } from "./contracts.service.js";
import { CreditsService } from "./credits.service.js";
import { DiscountsService } from "./discounts.service.js";
import { ReconciliationService } from "./reconciliation.service.js";

@Controller()
export class CommercialOpsController {
  constructor(
    private readonly credits: CreditsService,
    private readonly discounts: DiscountsService,
    private readonly contracts: ContractsService,
    private readonly reconciliation: ReconciliationService,
  ) {}

  // --- Credits ---

  @Get("api/v1/tenants/:tenantId/commercial/credits")
  @RequireAnyPermission(
    ["platform.credit.manage", "platform.billing.view", "platform.entitlement.manage"],
    { allowWhenSuspended: true },
  )
  async listCredits(@Param("tenantId") tenantId: string, @Req() req: RequestWithIds) {
    const data = await this.credits.list(tenantId);
    return ok(data, getRequestIds(req), { page: 1, pageSize: data.length, total: data.length });
  }

  @Post("api/v1/tenants/:tenantId/commercial/credits")
  @RequireAnyPermission(["platform.credit.manage", "platform.entitlement.manage"], {
    allowWhenSuspended: true,
  })
  @Idempotent({ resourceType: "account_credit" })
  async createCredit(
    @Param("tenantId") tenantId: string,
    @Body() body: unknown,
    @Principal() principal: ForgePrincipal,
    @Req() req: RequestWithIds,
  ) {
    return ok(await this.credits.create(tenantId, body, principal), getRequestIds(req));
  }

  @Post("api/v1/tenants/:tenantId/commercial/credits/:creditId/apply")
  @RequireAnyPermission(["platform.credit.manage", "platform.entitlement.manage"], {
    allowWhenSuspended: true,
  })
  async applyCredit(
    @Param("tenantId") tenantId: string,
    @Param("creditId") creditId: string,
    @Body() body: unknown,
    @Principal() principal: ForgePrincipal,
    @Req() req: RequestWithIds,
  ) {
    return ok(
      await this.credits.apply(tenantId, creditId, body, principal),
      getRequestIds(req),
    );
  }

  // --- Discounts ---

  @Get("api/v1/platform/commercial/discounts")
  @RequireAnyPermission(
    ["platform.discount.manage", "platform.billing.view", "platform.entitlement.manage"],
    { allowWhenSuspended: true },
  )
  async listPlatformDiscounts(@Req() req: RequestWithIds) {
    const data = await this.discounts.list(null);
    return ok(data, getRequestIds(req), { page: 1, pageSize: data.length, total: data.length });
  }

  @Get("api/v1/tenants/:tenantId/commercial/discounts")
  @RequireAnyPermission(
    ["platform.discount.manage", "platform.billing.view", "platform.entitlement.manage"],
    { allowWhenSuspended: true },
  )
  async listTenantDiscounts(@Param("tenantId") tenantId: string, @Req() req: RequestWithIds) {
    const data = await this.discounts.list(tenantId);
    return ok(data, getRequestIds(req), { page: 1, pageSize: data.length, total: data.length });
  }

  @Post("api/v1/platform/commercial/discounts")
  @RequireAnyPermission(["platform.discount.manage", "platform.entitlement.manage"], {
    allowWhenSuspended: true,
  })
  @Idempotent({ resourceType: "discount_definition" })
  async createDiscount(
    @Body() body: unknown,
    @Principal() principal: ForgePrincipal,
    @Req() req: RequestWithIds,
  ) {
    return ok(await this.discounts.create(body, principal), getRequestIds(req));
  }

  @Post("api/v1/tenants/:tenantId/commercial/subscriptions/:id/discounts")
  @RequireAnyPermission(["platform.discount.manage", "platform.entitlement.manage"], {
    allowWhenSuspended: true,
  })
  async linkDiscount(
    @Param("tenantId") tenantId: string,
    @Param("id") id: string,
    @Body() body: unknown,
    @Principal() principal: ForgePrincipal,
    @Req() req: RequestWithIds,
  ) {
    return ok(
      await this.discounts.linkToSubscription(tenantId, id, body, principal),
      getRequestIds(req),
    );
  }

  // --- Contracts ---

  @Get("api/v1/tenants/:tenantId/commercial/contracts")
  @RequireAnyPermission(
    ["platform.contract.view", "platform.entitlement.manage"],
    { allowWhenSuspended: true },
  )
  async listContracts(
    @Param("tenantId") tenantId: string,
    @Query("subscriptionId") subscriptionId: string | undefined,
    @Req() req: RequestWithIds,
  ) {
    const data = await this.contracts.list(tenantId, subscriptionId);
    return ok(data, getRequestIds(req), { page: 1, pageSize: data.length, total: data.length });
  }

  @Post("api/v1/tenants/:tenantId/commercial/contracts")
  @RequireAnyPermission(["platform.contract.manage", "platform.entitlement.manage"], {
    allowWhenSuspended: true,
  })
  @Idempotent({ resourceType: "subscription_contract" })
  async createContract(
    @Param("tenantId") tenantId: string,
    @Body() body: unknown,
    @Principal() principal: ForgePrincipal,
    @Req() req: RequestWithIds,
  ) {
    return ok(await this.contracts.create(tenantId, body, principal), getRequestIds(req));
  }

  @Patch("api/v1/tenants/:tenantId/commercial/contracts/:contractId")
  @RequireAnyPermission(["platform.contract.manage", "platform.entitlement.manage"], {
    allowWhenSuspended: true,
  })
  async updateContract(
    @Param("tenantId") tenantId: string,
    @Param("contractId") contractId: string,
    @Body() body: unknown,
    @Principal() principal: ForgePrincipal,
    @Req() req: RequestWithIds,
  ) {
    return ok(
      await this.contracts.update(tenantId, contractId, body, principal),
      getRequestIds(req),
    );
  }

  // --- Reconciliation ---

  @Get("api/v1/tenants/:tenantId/commercial/reconcile")
  @RequireAnyPermission(
    ["platform.subscription.view", "platform.entitlement.manage"],
    { allowWhenSuspended: true },
  )
  async reconcile(@Param("tenantId") tenantId: string, @Req() req: RequestWithIds) {
    return ok(await this.reconciliation.reconcile(tenantId), getRequestIds(req));
  }

  @Post("api/v1/tenants/:tenantId/commercial/reconcile")
  @RequireAnyPermission(
    ["platform.subscription.update", "platform.entitlement.manage"],
    { allowWhenSuspended: true },
  )
  async reconcileApply(
    @Param("tenantId") tenantId: string,
    @Body() body: unknown,
    @Principal() principal: ForgePrincipal,
    @Req() req: RequestWithIds,
  ) {
    return ok(await this.reconciliation.apply(tenantId, body, principal), getRequestIds(req));
  }
}
