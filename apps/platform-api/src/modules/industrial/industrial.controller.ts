import { Controller, Get, Req } from "@nestjs/common";
import type { ForgePrincipal } from "@forge/tenant-context";
import { ok } from "../../common/api-response.js";
import { getRequestIds, type RequestWithIds } from "../../common/request-ids.js";
import { Principal } from "../auth-context/principal.decorator.js";
import { RequirePermission } from "../auth-context/require-permission.decorator.js";
import { IndustrialService } from "./industrial.service.js";

@Controller("api/v1/industrial")
export class IndustrialController {
  constructor(private readonly industrial: IndustrialService) {}

  @Get("bootstrap")
  @RequirePermission("industrial.access", {
    requiresEntitlement: { productCode: "FORGE_INDUSTRIAL" },
    allowWhenSuspended: true,
  })
  async bootstrap(@Principal() principal: ForgePrincipal, @Req() req: RequestWithIds) {
    return ok(await this.industrial.bootstrap(principal), getRequestIds(req));
  }

  @Get("readiness")
  @RequirePermission("industrial.access", {
    requiresEntitlement: { productCode: "FORGE_INDUSTRIAL" },
    allowWhenSuspended: true,
  })
  async readiness(@Principal() principal: ForgePrincipal, @Req() req: RequestWithIds) {
    return ok(await this.industrial.readiness(principal), getRequestIds(req));
  }
}
