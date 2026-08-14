import { Body, Controller, Get, Param, Post, Query, Req } from "@nestjs/common";
import type { ForgePrincipal } from "@forge/tenant-context";
import { ok } from "../../common/api-response.js";
import { Idempotent } from "../../common/idempotent.decorator.js";
import { getRequestIds, type RequestWithIds } from "../../common/request-ids.js";
import { Principal } from "../auth-context/principal.decorator.js";
import { RequireAnyPermission } from "../auth-context/require-permission.decorator.js";
import { IndustrialOpsService } from "./industrial-ops.service.js";

const ENTITLEMENT = { productCode: "FORGE_INDUSTRIAL" as const };

type ListQuery = Record<string, string | undefined>;

const ACCESS = ["industrial.access", "industrial.admin"] as const;
const MANAGE = ["industrial.admin"] as const;

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

  @Get("personnel/:id")
  @RequireAnyPermission(["industrial.personnel.view", "industrial.admin", "industrial.access"], {
    requiresEntitlement: ENTITLEMENT,
  })
  async getPersonnel(
    @Principal() principal: ForgePrincipal,
    @Param("id") id: string,
    @Req() req: RequestWithIds,
  ) {
    return ok(await this.ops.get(principal, "personnel", id), getRequestIds(req));
  }

  @Post("personnel/:id/status")
  @RequireAnyPermission(["industrial.personnel.manage", "industrial.admin"], {
    requiresEntitlement: ENTITLEMENT,
  })
  @Idempotent({ resourceType: "industrial_personnel_status" })
  async statusPersonnel(
    @Principal() principal: ForgePrincipal,
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() req: RequestWithIds,
  ) {
    return ok(await this.ops.updateStatus(principal, "personnel", id, body), getRequestIds(req));
  }

  @Post("personnel/:id/fields")
  @RequireAnyPermission(["industrial.personnel.manage", "industrial.admin"], {
    requiresEntitlement: ENTITLEMENT,
  })
  @Idempotent({ resourceType: "industrial_personnel_fields" })
  async fieldsPersonnel(
    @Principal() principal: ForgePrincipal,
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() req: RequestWithIds,
  ) {
    return ok(await this.ops.updateFields(principal, "personnel", id, body), getRequestIds(req));
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

  @Get("training/:id")
  @RequireAnyPermission(["industrial.training.view", "industrial.admin", "industrial.access"], {
    requiresEntitlement: ENTITLEMENT,
  })
  async getTraining(
    @Principal() principal: ForgePrincipal,
    @Param("id") id: string,
    @Req() req: RequestWithIds,
  ) {
    return ok(await this.ops.get(principal, "training", id), getRequestIds(req));
  }

  @Post("training/:id/status")
  @RequireAnyPermission(["industrial.training.manage", "industrial.admin"], {
    requiresEntitlement: ENTITLEMENT,
  })
  @Idempotent({ resourceType: "industrial_training_status" })
  async statusTraining(
    @Principal() principal: ForgePrincipal,
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() req: RequestWithIds,
  ) {
    return ok(await this.ops.updateStatus(principal, "training", id, body), getRequestIds(req));
  }

  @Post("training/:id/fields")
  @RequireAnyPermission(["industrial.training.manage", "industrial.admin"], {
    requiresEntitlement: ENTITLEMENT,
  })
  @Idempotent({ resourceType: "industrial_training_fields" })
  async fieldsTraining(
    @Principal() principal: ForgePrincipal,
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() req: RequestWithIds,
  ) {
    return ok(await this.ops.updateFields(principal, "training", id, body), getRequestIds(req));
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

  @Get("forms/:id")
  @RequireAnyPermission(["industrial.forms.view", "industrial.admin", "industrial.access"], {
    requiresEntitlement: ENTITLEMENT,
  })
  async getForms(
    @Principal() principal: ForgePrincipal,
    @Param("id") id: string,
    @Req() req: RequestWithIds,
  ) {
    return ok(await this.ops.get(principal, "forms", id), getRequestIds(req));
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

  @Get("inspections/:id")
  @RequireAnyPermission(["industrial.inspections.view", "industrial.admin", "industrial.access"], {
    requiresEntitlement: ENTITLEMENT,
  })
  async getInspections(
    @Principal() principal: ForgePrincipal,
    @Param("id") id: string,
    @Req() req: RequestWithIds,
  ) {
    return ok(await this.ops.get(principal, "inspections", id), getRequestIds(req));
  }

  @Post("inspections/:id/status")
  @RequireAnyPermission(["industrial.inspections.manage", "industrial.admin"], {
    requiresEntitlement: ENTITLEMENT,
  })
  @Idempotent({ resourceType: "industrial_inspections_status" })
  async statusInspections(
    @Principal() principal: ForgePrincipal,
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() req: RequestWithIds,
  ) {
    return ok(await this.ops.updateStatus(principal, "inspections", id, body), getRequestIds(req));
  }

  @Post("inspections/:id/fields")
  @RequireAnyPermission(["industrial.inspections.manage", "industrial.admin"], {
    requiresEntitlement: ENTITLEMENT,
  })
  @Idempotent({ resourceType: "industrial_inspections_fields" })
  async fieldsInspections(
    @Principal() principal: ForgePrincipal,
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() req: RequestWithIds,
  ) {
    return ok(await this.ops.updateFields(principal, "inspections", id, body), getRequestIds(req));
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

  @Get("incidents/:id")
  @RequireAnyPermission(["industrial.incidents.view", "industrial.admin", "industrial.access"], {
    requiresEntitlement: ENTITLEMENT,
  })
  async getIncidents(
    @Principal() principal: ForgePrincipal,
    @Param("id") id: string,
    @Req() req: RequestWithIds,
  ) {
    return ok(await this.ops.get(principal, "incidents", id), getRequestIds(req));
  }

  @Post("incidents/:id/status")
  @RequireAnyPermission(["industrial.incidents.manage", "industrial.admin"], {
    requiresEntitlement: ENTITLEMENT,
  })
  @Idempotent({ resourceType: "industrial_incidents_status" })
  async statusIncidents(
    @Principal() principal: ForgePrincipal,
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() req: RequestWithIds,
  ) {
    return ok(await this.ops.updateStatus(principal, "incidents", id, body), getRequestIds(req));
  }

  @Post("incidents/:id/fields")
  @RequireAnyPermission(["industrial.incidents.manage", "industrial.admin"], {
    requiresEntitlement: ENTITLEMENT,
  })
  @Idempotent({ resourceType: "industrial_incidents_fields" })
  async fieldsIncidents(
    @Principal() principal: ForgePrincipal,
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() req: RequestWithIds,
  ) {
    return ok(await this.ops.updateFields(principal, "incidents", id, body), getRequestIds(req));
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

  @Get("jsas/:id")
  @RequireAnyPermission(["industrial.jsa.view", "industrial.admin", "industrial.access"], {
    requiresEntitlement: ENTITLEMENT,
  })
  async getJsas(
    @Principal() principal: ForgePrincipal,
    @Param("id") id: string,
    @Req() req: RequestWithIds,
  ) {
    return ok(await this.ops.get(principal, "jsas", id), getRequestIds(req));
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

  @Get("observations/:id")
  @RequireAnyPermission(["industrial.observations.view", "industrial.admin", "industrial.access"], {
    requiresEntitlement: ENTITLEMENT,
  })
  async getObservations(
    @Principal() principal: ForgePrincipal,
    @Param("id") id: string,
    @Req() req: RequestWithIds,
  ) {
    return ok(await this.ops.get(principal, "observations", id), getRequestIds(req));
  }

  @Get("equipment")
  @RequireAnyPermission([...ACCESS, "industrial.equipment.view"], {
    requiresEntitlement: ENTITLEMENT,
  })
  async listEquipment(
    @Principal() principal: ForgePrincipal,
    @Query() query: ListQuery,
    @Req() req: RequestWithIds,
  ) {
    return this.listOk(await this.ops.list(principal, "equipment", query), req);
  }

  @Post("equipment")
  @RequireAnyPermission([...MANAGE, "industrial.equipment.manage"], {
    requiresEntitlement: ENTITLEMENT,
  })
  @Idempotent({ resourceType: "industrial_equipment" })
  async createEquipment(
    @Principal() principal: ForgePrincipal,
    @Body() body: unknown,
    @Req() req: RequestWithIds,
  ) {
    return ok(await this.ops.create(principal, "equipment", body), getRequestIds(req));
  }

  @Get("equipment/:id")
  @RequireAnyPermission([...ACCESS, "industrial.equipment.view"], {
    requiresEntitlement: ENTITLEMENT,
  })
  async getEquipment(
    @Principal() principal: ForgePrincipal,
    @Param("id") id: string,
    @Req() req: RequestWithIds,
  ) {
    return ok(await this.ops.get(principal, "equipment", id), getRequestIds(req));
  }

  @Post("equipment/:id/archive")
  @RequireAnyPermission([...MANAGE, "industrial.equipment.manage"], {
    requiresEntitlement: ENTITLEMENT,
  })
  @Idempotent({ resourceType: "industrial_equipment_archive" })
  async archiveEquipment(
    @Principal() principal: ForgePrincipal,
    @Param("id") id: string,
    @Req() req: RequestWithIds,
  ) {
    return ok(await this.ops.archive(principal, "equipment", id), getRequestIds(req));
  }

  @Get("sites")
  @RequireAnyPermission([...ACCESS], { requiresEntitlement: ENTITLEMENT })
  async listSites(
    @Principal() principal: ForgePrincipal,
    @Query() query: ListQuery,
    @Req() req: RequestWithIds,
  ) {
    return this.listOk(await this.ops.list(principal, "sites", query), req);
  }

  @Post("sites")
  @RequireAnyPermission([...MANAGE], { requiresEntitlement: ENTITLEMENT })
  @Idempotent({ resourceType: "industrial_sites" })
  async createSite(
    @Principal() principal: ForgePrincipal,
    @Body() body: unknown,
    @Req() req: RequestWithIds,
  ) {
    return ok(await this.ops.create(principal, "sites", body), getRequestIds(req));
  }

  @Get("loto")
  @RequireAnyPermission([...ACCESS, "industrial.loto.view"], { requiresEntitlement: ENTITLEMENT })
  async listLoto(
    @Principal() principal: ForgePrincipal,
    @Query() query: ListQuery,
    @Req() req: RequestWithIds,
  ) {
    return this.listOk(await this.ops.list(principal, "loto", query), req);
  }

  @Post("loto")
  @RequireAnyPermission(
    [...MANAGE, "industrial.loto.edit", "industrial.loto.manage", "industrial.loto.create"],
    { requiresEntitlement: ENTITLEMENT },
  )
  @Idempotent({ resourceType: "industrial_loto" })
  async createLoto(
    @Principal() principal: ForgePrincipal,
    @Body() body: unknown,
    @Req() req: RequestWithIds,
  ) {
    return ok(await this.ops.create(principal, "loto", body), getRequestIds(req));
  }

  @Get("loto/:id")
  @RequireAnyPermission([...ACCESS, "industrial.loto.view"], { requiresEntitlement: ENTITLEMENT })
  async getLoto(
    @Principal() principal: ForgePrincipal,
    @Param("id") id: string,
    @Req() req: RequestWithIds,
  ) {
    return ok(await this.ops.get(principal, "loto", id), getRequestIds(req));
  }

  @Post("loto/:id/status")
  @RequireAnyPermission(
    [...MANAGE, "industrial.loto.edit", "industrial.loto.manage", "industrial.loto.approve"],
    { requiresEntitlement: ENTITLEMENT },
  )
  @Idempotent({ resourceType: "industrial_loto_status" })
  async statusLoto(
    @Principal() principal: ForgePrincipal,
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() req: RequestWithIds,
  ) {
    return ok(await this.ops.updateStatus(principal, "loto", id, body), getRequestIds(req));
  }
}
