import { Body, Controller, Get, Param, Post, Query, Req } from "@nestjs/common";
import type { ForgePrincipal } from "@forge/tenant-context";
import { ok } from "../../common/api-response.js";
import { Idempotent } from "../../common/idempotent.decorator.js";
import { getRequestIds, type RequestWithIds } from "../../common/request-ids.js";
import { Principal } from "../auth-context/principal.decorator.js";
import {
  RequireAnyPermission,
  RequirePermission,
} from "../auth-context/require-permission.decorator.js";
import { IndustrialBootstrapService } from "./industrial-bootstrap.service.js";
import { IndustrialDomainService } from "./industrial-domain.service.js";

const ENTITLEMENT = { productCode: "FORGE_INDUSTRIAL" as const };
type ListQuery = Record<string, string | undefined>;

/**
 * Flat Industrial API used by industrial-web.
 * Backed by Model A normalized tables (not industrial_ops_records).
 */
@Controller("api/v1/industrial")
export class IndustrialFlatController {
  constructor(
    private readonly bootstrapService: IndustrialBootstrapService,
    private readonly domain: IndustrialDomainService,
  ) {}

  private listOk(
    data: { items: unknown[]; page: number; pageSize: number },
    req: RequestWithIds,
  ) {
    return ok(data, getRequestIds(req), {
      page: data.page,
      pageSize: data.pageSize,
      total: data.items.length,
    });
  }

  @Get("bootstrap")
  @RequirePermission("industrial.access", {
    requiresEntitlement: ENTITLEMENT,
    allowWhenSuspended: true,
  })
  async bootstrap(@Principal() principal: ForgePrincipal, @Req() req: RequestWithIds) {
    return ok(await this.bootstrapService.bootstrap(principal), getRequestIds(req));
  }

  @Get("readiness")
  @RequirePermission("industrial.access", {
    requiresEntitlement: ENTITLEMENT,
    allowWhenSuspended: true,
  })
  async readiness(@Principal() principal: ForgePrincipal, @Req() req: RequestWithIds) {
    return ok(await this.bootstrapService.readiness(principal), getRequestIds(req));
  }

  @Get("personnel")
  @RequireAnyPermission(["industrial.personnel.view", "industrial.admin", "industrial.access"], {
    requiresEntitlement: ENTITLEMENT,
  })
  async listPersonnel(
    @Principal() principal: ForgePrincipal,
    @Query() query: ListQuery,
    @Req() req: RequestWithIds,
  ) {
    return this.listOk(await this.domain.listPersonnel(principal, query), req);
  }

  @Get("personnel/:id")
  @RequireAnyPermission(["industrial.personnel.view", "industrial.admin", "industrial.access"], {
    requiresEntitlement: ENTITLEMENT,
  })
  async getPersonnel(
    @Principal() principal: ForgePrincipal,
    @Param("id") id: string,
    @Req() req: RequestWithIds,
  ) {
    return ok(await this.domain.getPersonnel(principal, id), getRequestIds(req));
  }

  @Get("sites")
  @RequireAnyPermission(["industrial.access", "industrial.admin"], {
    requiresEntitlement: ENTITLEMENT,
  })
  async listSites(
    @Principal() principal: ForgePrincipal,
    @Query() query: ListQuery,
    @Req() req: RequestWithIds,
  ) {
    return this.listOk(await this.domain.listSites(principal, query), req);
  }

  @Get("equipment")
  @RequireAnyPermission(["industrial.equipment.view", "industrial.admin", "industrial.access"], {
    requiresEntitlement: ENTITLEMENT,
  })
  async listEquipment(
    @Principal() principal: ForgePrincipal,
    @Query() query: ListQuery,
    @Req() req: RequestWithIds,
  ) {
    return this.listOk(await this.domain.listEquipment(principal, query), req);
  }

  @Get("incidents")
  @RequireAnyPermission(["industrial.incidents.view", "industrial.admin", "industrial.access"], {
    requiresEntitlement: ENTITLEMENT,
  })
  async listIncidents(
    @Principal() principal: ForgePrincipal,
    @Query() query: ListQuery,
    @Req() req: RequestWithIds,
  ) {
    return this.listOk(await this.domain.listIncidents(principal, query), req);
  }

  @Post("incidents")
  @RequireAnyPermission(["industrial.incidents.manage", "industrial.admin"], {
    requiresEntitlement: ENTITLEMENT,
  })
  @Idempotent({ resourceType: "industrial_incidents" })
  async createIncident(
    @Principal() principal: ForgePrincipal,
    @Body() body: Record<string, unknown>,
    @Req() req: RequestWithIds,
  ) {
    return ok(await this.domain.createIncident(principal, body), getRequestIds(req));
  }

  @Get("incidents/:id")
  @RequireAnyPermission(["industrial.incidents.view", "industrial.admin", "industrial.access"], {
    requiresEntitlement: ENTITLEMENT,
  })
  async getIncident(
    @Principal() principal: ForgePrincipal,
    @Param("id") id: string,
    @Req() req: RequestWithIds,
  ) {
    return ok(await this.domain.getIncident(principal, id), getRequestIds(req));
  }

  @Get("inspections")
  @RequireAnyPermission(["industrial.inspections.view", "industrial.admin", "industrial.access"], {
    requiresEntitlement: ENTITLEMENT,
  })
  async listInspections(
    @Principal() principal: ForgePrincipal,
    @Query() query: ListQuery,
    @Req() req: RequestWithIds,
  ) {
    return this.listOk(await this.domain.listInspections(principal, query), req);
  }

  @Post("inspections")
  @RequireAnyPermission(["industrial.inspections.manage", "industrial.admin"], {
    requiresEntitlement: ENTITLEMENT,
  })
  @Idempotent({ resourceType: "industrial_inspections" })
  async createInspection(
    @Principal() principal: ForgePrincipal,
    @Body() body: Record<string, unknown>,
    @Req() req: RequestWithIds,
  ) {
    return ok(await this.domain.createInspection(principal, body), getRequestIds(req));
  }

  @Get("inspections/:id")
  @RequireAnyPermission(["industrial.inspections.view", "industrial.admin", "industrial.access"], {
    requiresEntitlement: ENTITLEMENT,
  })
  async getInspection(
    @Principal() principal: ForgePrincipal,
    @Param("id") id: string,
    @Req() req: RequestWithIds,
  ) {
    return ok(await this.domain.getInspection(principal, id), getRequestIds(req));
  }

  @Get("observations")
  @RequireAnyPermission(["industrial.observations.view", "industrial.admin", "industrial.access"], {
    requiresEntitlement: ENTITLEMENT,
  })
  async listObservations(
    @Principal() principal: ForgePrincipal,
    @Query() query: ListQuery,
    @Req() req: RequestWithIds,
  ) {
    return this.listOk(await this.domain.listObservations(principal, query), req);
  }

  @Get("jsas")
  @RequireAnyPermission(["industrial.jsa.view", "industrial.admin", "industrial.access"], {
    requiresEntitlement: ENTITLEMENT,
  })
  async listJsas(
    @Principal() principal: ForgePrincipal,
    @Query() query: ListQuery,
    @Req() req: RequestWithIds,
  ) {
    return this.listOk(await this.domain.listJsas(principal, query), req);
  }

  @Get("loto")
  @RequireAnyPermission(["industrial.loto.view", "industrial.admin", "industrial.access"], {
    requiresEntitlement: ENTITLEMENT,
  })
  async listLoto(
    @Principal() principal: ForgePrincipal,
    @Query() query: ListQuery,
    @Req() req: RequestWithIds,
  ) {
    return this.listOk(await this.domain.listLoto(principal, query), req);
  }
}
