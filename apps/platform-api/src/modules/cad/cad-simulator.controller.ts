import { Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import type { ForgePrincipal } from "@forge/tenant-context";
import { ok } from "../../common/api-response.js";
import { getRequestIds, type RequestWithIds } from "../../common/request-ids.js";
import { Principal } from "../auth-context/principal.decorator.js";
import { RequirePermission } from "../auth-context/require-permission.decorator.js";
import { CadSimulatorService } from "./cad-simulator.service.js";

@Controller()
export class CadSimulatorController {
  constructor(private readonly simulator: CadSimulatorService) {}

  @Get("api/v1/tenants/:tenantId/cad/simulator/scenarios")
  @RequirePermission("rms.cad.operations.view")
  async scenarios(@Param("tenantId") tenantId: string, @Req() req: RequestWithIds) {
    return ok(await this.simulator.listScenarios(tenantId), getRequestIds(req));
  }

  @Post("api/v1/tenants/:tenantId/cad/simulator/send")
  @RequirePermission("rms.cad.operations.view")
  async send(
    @Param("tenantId") tenantId: string,
    @Body() body: unknown,
    @Principal() principal: ForgePrincipal,
    @Req() req: RequestWithIds,
  ) {
    return ok(await this.simulator.send(tenantId, body, principal), getRequestIds(req));
  }

  @Post("api/v1/tenants/:tenantId/cad/simulator/outage")
  @RequirePermission("rms.cad.connection.manage")
  async outage(
    @Param("tenantId") tenantId: string,
    @Body() body: unknown,
    @Principal() principal: ForgePrincipal,
    @Req() req: RequestWithIds,
  ) {
    return ok(await this.simulator.startOutage(tenantId, body, principal), getRequestIds(req));
  }

  @Post("api/v1/tenants/:tenantId/cad/simulator/recover")
  @RequirePermission("rms.cad.connection.manage")
  async recover(
    @Param("tenantId") tenantId: string,
    @Body() body: unknown,
    @Principal() principal: ForgePrincipal,
    @Req() req: RequestWithIds,
  ) {
    return ok(await this.simulator.recoverOutage(tenantId, body, principal), getRequestIds(req));
  }

  @Post("api/v1/tenants/:tenantId/cad/simulator/quarantine-message")
  @RequirePermission("rms.cad.message.quarantine")
  async quarantineMessage(
    @Param("tenantId") tenantId: string,
    @Body() body: unknown,
    @Principal() principal: ForgePrincipal,
    @Req() req: RequestWithIds,
  ) {
    return ok(
      await this.simulator.quarantineMessage(tenantId, body, principal),
      getRequestIds(req),
    );
  }

  @Get("api/v1/tenants/:tenantId/cad/simulator/outages")
  @RequirePermission("rms.cad.operations.view")
  async outages(@Param("tenantId") tenantId: string, @Req() req: RequestWithIds) {
    return ok(await this.simulator.listOutages(tenantId), getRequestIds(req));
  }
}
