import { Body, Controller, Get, Post, Req } from "@nestjs/common";
import type { ForgePrincipal } from "@forge/tenant-context";
import { z } from "zod";
import { ok } from "../../common/api-response.js";
import { getRequestIds, type RequestWithIds } from "../../common/request-ids.js";
import { AuthContextService } from "./auth-context.service.js";
import { Principal } from "./principal.decorator.js";

const selectTenantSchema = z.object({
  tenantId: z.string().uuid(),
  productCode: z.string().min(1).max(64).optional(),
  reason: z.string().min(1).max(256).optional(),
});

@Controller("api/v1/auth")
export class AuthMeController {
  constructor(private readonly authContext: AuthContextService) {}

  @Get("me")
  async me(@Principal() principal: ForgePrincipal, @Req() req: RequestWithIds) {
    const tenants = await this.authContext.listAvailableTenants(principal.userId, {
      isPlatformAdmin: principal.isPlatformAdmin,
    });
    const accessMode = principal.isPlatformAdmin ? "PLATFORM_ADMIN_SUPPORT" : "MEMBER";
    return ok(
      {
        ...this.authContext.toClientSummary(principal, accessMode),
        tenants,
      },
      getRequestIds(req),
    );
  }

  @Post("select-tenant")
  async selectTenant(
    @Body() body: unknown,
    @Principal() principal: ForgePrincipal,
    @Req() req: RequestWithIds,
  ) {
    const parsed = selectTenantSchema.parse(body);
    const selected = await this.authContext.selectTenant(principal, parsed.tenantId, {
      ...(parsed.productCode ? { productCode: parsed.productCode } : {}),
      ...(parsed.reason ? { reason: parsed.reason } : {}),
    });
    const tenants = await this.authContext.listAvailableTenants(principal.userId, {
      isPlatformAdmin: principal.isPlatformAdmin,
    });
    return ok({ ...selected, tenants }, getRequestIds(req));
  }

  @Post("logout-all")
  async logoutAll(@Principal() principal: ForgePrincipal, @Req() req: RequestWithIds) {
    return ok(await this.authContext.logoutAll(principal), getRequestIds(req));
  }
}
