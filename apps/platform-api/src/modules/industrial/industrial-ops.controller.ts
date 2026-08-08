import { Body, Controller, Get, Post, Query, Req } from "@nestjs/common";
import type { ForgePrincipal } from "@forge/tenant-context";
import { ok } from "../../common/api-response.js";
import { Idempotent } from "../../common/idempotent.decorator.js";
import { getRequestIds, type RequestWithIds } from "../../common/request-ids.js";
import { Principal } from "../auth-context/principal.decorator.js";
import { RequireAnyPermission } from "../auth-context/require-permission.decorator.js";
import { IndustrialOpsService } from "./industrial-ops.service.js";

const ENTITLEMENT = { productCode: "FORGE_INDUSTRIAL" as const };

type ListQuery = Record<string, string | undefined>;

@Controller("api/v1/industrial")
export class IndustrialOpsController {
  constructor(private readonly ops: IndustrialOpsService) {}

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

  @Get("personnel")
  @RequireAnyPermission(["industrial.personnel.view", "industrial.admin", "industrial.access"], {
    requiresEntitlement: ENTITLEMENT,
  })
  async listPersonnel(
    @Principal() principal: ForgePrincipal,
    @Query() query: ListQuery,
    @Req() req: RequestWithIds,
  ) {
    return this.listOk(await this.ops.list(principal, "personnel", query), req);
  }

  @Post("personnel")
  @RequireAnyPermission(["industrial.personnel.manage", "industrial.admin"], {
    requiresEntitlement: ENTITLEMENT,
  })
  @Idempotent({ resourceType: "industrial_personnel" })
  async createPersonnel(
    @Principal() principal: ForgePrincipal,
    @Body() body: unknown,
    @Req() req: RequestWithIds,
  ) {
    return ok(await this.ops.create(principal, "personnel", body), getRequestIds(req));
  }

  @Get("training")
  @RequireAnyPermission(["industrial.training.view", "industrial.admin", "industrial.access"], {
    requiresEntitlement: ENTITLEMENT,
  })
  async listTraining(
    @Principal() principal: ForgePrincipal,
    @Query() query: ListQuery,
    @Req() req: RequestWithIds,
  ) {
    return this.listOk(await this.ops.list(principal, "training", query), req);
  }

  @Post("training")
  @RequireAnyPermission(["industrial.training.manage", "industrial.admin"], {
    requiresEntitlement: ENTITLEMENT,
  })
  @Idempotent({ resourceType: "industrial_training" })
  async createTraining(
    @Principal() principal: ForgePrincipal,
    @Body() body: unknown,
    @Req() req: RequestWithIds,
  ) {
    return ok(await this.ops.create(principal, "training", body), getRequestIds(req));
  }

  @Get("forms")
  @RequireAnyPermission(["industrial.forms.view", "industrial.admin", "industrial.access"], {
    requiresEntitlement: ENTITLEMENT,
  })
  async listForms(
    @Principal() principal: ForgePrincipal,
    @Query() query: ListQuery,
    @Req() req: RequestWithIds,
  ) {
    return this.listOk(await this.ops.list(principal, "forms", query), req);
  }

  @Post("forms")
  @RequireAnyPermission(["industrial.forms.manage", "industrial.admin"], {
    requiresEntitlement: ENTITLEMENT,
  })
  @Idempotent({ resourceType: "industrial_forms" })
  async createForms(
    @Principal() principal: ForgePrincipal,
    @Body() body: unknown,
    @Req() req: RequestWithIds,
  ) {
    return ok(await this.ops.create(principal, "forms", body), getRequestIds(req));
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
    return this.listOk(await this.ops.list(principal, "inspections", query), req);
  }

  @Post("inspections")
  @RequireAnyPermission(["industrial.inspections.manage", "industrial.admin"], {
    requiresEntitlement: ENTITLEMENT,
  })
  @Idempotent({ resourceType: "industrial_inspections" })
  async createInspections(
    @Principal() principal: ForgePrincipal,
    @Body() body: unknown,
    @Req() req: RequestWithIds,
  ) {
    return ok(await this.ops.create(principal, "inspections", body), getRequestIds(req));
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
    return this.listOk(await this.ops.list(principal, "incidents", query), req);
  }

  @Post("incidents")
  @RequireAnyPermission(["industrial.incidents.manage", "industrial.admin"], {
    requiresEntitlement: ENTITLEMENT,
  })
  @Idempotent({ resourceType: "industrial_incidents" })
  async createIncidents(
    @Principal() principal: ForgePrincipal,
    @Body() body: unknown,
    @Req() req: RequestWithIds,
  ) {
    return ok(await this.ops.create(principal, "incidents", body), getRequestIds(req));
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
    return this.listOk(await this.ops.list(principal, "jsas", query), req);
  }

  @Post("jsas")
  @RequireAnyPermission(["industrial.jsa.manage", "industrial.admin"], {
    requiresEntitlement: ENTITLEMENT,
  })
  @Idempotent({ resourceType: "industrial_jsas" })
  async createJsas(
    @Principal() principal: ForgePrincipal,
    @Body() body: unknown,
    @Req() req: RequestWithIds,
  ) {
    return ok(await this.ops.create(principal, "jsas", body), getRequestIds(req));
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
    return this.listOk(await this.ops.list(principal, "observations", query), req);
  }

  @Post("observations")
  @RequireAnyPermission(["industrial.observations.manage", "industrial.admin"], {
    requiresEntitlement: ENTITLEMENT,
  })
  @Idempotent({ resourceType: "industrial_observations" })
  async createObservations(
    @Principal() principal: ForgePrincipal,
    @Body() body: unknown,
    @Req() req: RequestWithIds,
  ) {
    return ok(await this.ops.create(principal, "observations", body), getRequestIds(req));
  }
}
