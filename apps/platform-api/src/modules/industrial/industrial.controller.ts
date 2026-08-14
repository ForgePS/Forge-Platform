import { Body, Controller, Get, Param, Patch, Post, Req } from "@nestjs/common";
import { ForgeError } from "@forge/errors";
import { ok } from "../../common/api-response.js";
import { getRequestIds, type RequestWithIds } from "../../common/request-ids.js";
import { RequirePermission } from "../auth-context/require-permission.decorator.js";
import { IndustrialService } from "./industrial.service.js";

@Controller("api/v1/tenants/:tenantId/industrial")
export class IndustrialController {
  constructor(private readonly industrial: IndustrialService) {}

  @Get("sites")
  @RequirePermission("industrial.access", {
    requiresEntitlement: { productCode: "FORGE_INDUSTRIAL" },
  })
  async listSites(@Param("tenantId") tenantId: string, @Req() req: RequestWithIds) {
    const data = await this.industrial.listSites(tenantId);
    return ok(data, getRequestIds(req), { page: 1, pageSize: data.length, total: data.length });
  }

  @Get("sites/:siteId")
  @RequirePermission("industrial.access", {
    requiresEntitlement: { productCode: "FORGE_INDUSTRIAL" },
  })
  async getSite(
    @Param("tenantId") tenantId: string,
    @Param("siteId") siteId: string,
    @Req() req: RequestWithIds,
  ) {
    const data = await this.industrial.getSite(tenantId, siteId);
    return ok(data, getRequestIds(req));
  }

  @Get("departments")
  @RequirePermission("industrial.access", {
    requiresEntitlement: { productCode: "FORGE_INDUSTRIAL" },
  })
  async listDepartments(@Param("tenantId") tenantId: string, @Req() req: RequestWithIds) {
    const data = await this.industrial.listDepartments(tenantId);
    return ok(data, getRequestIds(req), { page: 1, pageSize: data.length, total: data.length });
  }

  @Post("departments")
  @RequirePermission("industrial.access", {
    requiresEntitlement: { productCode: "FORGE_INDUSTRIAL" },
  })
  async createDepartment(
    @Param("tenantId") tenantId: string,
    @Body() body: Record<string, unknown>,
    @Req() req: RequestWithIds,
  ) {
    const input: Parameters<IndustrialService["createDepartment"]>[1] = {
      name: String(body.name ?? ""),
    };
    if (typeof body.description === "string") input.description = body.description;
    const data = await this.industrial.createDepartment(tenantId, input);
    return ok(data, getRequestIds(req));
  }

  @Get("positions")
  @RequirePermission("industrial.access", {
    requiresEntitlement: { productCode: "FORGE_INDUSTRIAL" },
  })
  async listPositions(@Param("tenantId") tenantId: string, @Req() req: RequestWithIds) {
    const data = await this.industrial.listPositions(tenantId);
    return ok(data, getRequestIds(req), { page: 1, pageSize: data.length, total: data.length });
  }

  @Post("positions")
  @RequirePermission("industrial.access", {
    requiresEntitlement: { productCode: "FORGE_INDUSTRIAL" },
  })
  async createPosition(
    @Param("tenantId") tenantId: string,
    @Body() body: Record<string, unknown>,
    @Req() req: RequestWithIds,
  ) {
    const input: Parameters<IndustrialService["createPosition"]>[1] = {
      name: String(body.name ?? ""),
    };
    if (typeof body.description === "string") input.description = body.description;
    if (typeof body.departmentId === "string") input.departmentId = body.departmentId;
    const data = await this.industrial.createPosition(tenantId, input);
    return ok(data, getRequestIds(req));
  }

  @Patch("positions/:id")
  @RequirePermission("industrial.access", {
    requiresEntitlement: { productCode: "FORGE_INDUSTRIAL" },
  })
  async archivePosition(
    @Param("tenantId") tenantId: string,
    @Param("id") id: string,
    @Req() req: RequestWithIds,
  ) {
    const data = await this.industrial.archivePosition(tenantId, id);
    return ok(data, getRequestIds(req));
  }

  @Get("employment-types")
  @RequirePermission("industrial.access", {
    requiresEntitlement: { productCode: "FORGE_INDUSTRIAL" },
  })
  async listEmploymentTypes(@Param("tenantId") tenantId: string, @Req() req: RequestWithIds) {
    const data = await this.industrial.listEmploymentTypes(tenantId);
    return ok(data, getRequestIds(req), { page: 1, pageSize: data.length, total: data.length });
  }

  @Post("employment-types")
  @RequirePermission("industrial.access", {
    requiresEntitlement: { productCode: "FORGE_INDUSTRIAL" },
  })
  async createEmploymentType(
    @Param("tenantId") tenantId: string,
    @Body() body: Record<string, unknown>,
    @Req() req: RequestWithIds,
  ) {
    const input: Parameters<IndustrialService["createEmploymentType"]>[1] = {
      name: String(body.name ?? ""),
    };
    if (typeof body.description === "string") input.description = body.description;
    const data = await this.industrial.createEmploymentType(tenantId, input);
    return ok(data, getRequestIds(req));
  }

  @Patch("employment-types/:id")
  @RequirePermission("industrial.access", {
    requiresEntitlement: { productCode: "FORGE_INDUSTRIAL" },
  })
  async archiveEmploymentType(
    @Param("tenantId") tenantId: string,
    @Param("id") id: string,
    @Req() req: RequestWithIds,
  ) {
    const data = await this.industrial.archiveEmploymentType(tenantId, id);
    return ok(data, getRequestIds(req));
  }

  @Get("personnel")
  @RequirePermission("industrial.access", {
    requiresEntitlement: { productCode: "FORGE_INDUSTRIAL" },
  })
  async listPersonnel(@Param("tenantId") tenantId: string, @Req() req: RequestWithIds) {
    const data = await this.industrial.listPersonnel(tenantId);
    return ok(data, getRequestIds(req), { page: 1, pageSize: data.length, total: data.length });
  }

  @Post("org-lookups/create-missing")
  @RequirePermission("industrial.access", {
    requiresEntitlement: { productCode: "FORGE_INDUSTRIAL" },
  })
  async createMissingOrgLookup(
    @Param("tenantId") tenantId: string,
    @Body() body: Record<string, unknown>,
    @Req() req: RequestWithIds,
  ) {
    const kind = String(body.kind ?? "") as "department" | "position" | "employment_type";
    if (kind !== "department" && kind !== "position" && kind !== "employment_type") {
      throw new ForgeError(
        "VALIDATION_FAILED",
        "kind must be department, position, or employment_type",
      );
    }
    const input: Parameters<IndustrialService["createMissingOrgLookup"]>[1] = {
      kind,
      name: String(body.name ?? ""),
    };
    if (typeof body.description === "string") input.description = body.description;
    const data = await this.industrial.createMissingOrgLookup(tenantId, input);
    return ok(data, getRequestIds(req));
  }

  @Get("loto/procedures")
  @RequirePermission("industrial.loto.view", {
    requiresEntitlement: { productCode: "FORGE_INDUSTRIAL" },
  })
  async listLotoProcedures(@Param("tenantId") tenantId: string, @Req() req: RequestWithIds) {
    const data = await this.industrial.listLotoProcedures(tenantId);
    return ok(data, getRequestIds(req), { page: 1, pageSize: data.length, total: data.length });
  }

  @Get("loto/records")
  @RequirePermission("industrial.loto.view", {
    requiresEntitlement: { productCode: "FORGE_INDUSTRIAL" },
  })
  async listLotoRecords(@Param("tenantId") tenantId: string, @Req() req: RequestWithIds) {
    const data = await this.industrial.listLotoRecords(tenantId);
    return ok(data, getRequestIds(req), { page: 1, pageSize: data.length, total: data.length });
  }

  @Get("fleet/vehicles")
  @RequirePermission("industrial.fleet.view", {
    requiresEntitlement: { productCode: "FORGE_INDUSTRIAL" },
  })
  async listFleetVehicles(@Param("tenantId") tenantId: string, @Req() req: RequestWithIds) {
    const data = await this.industrial.listFleetVehicles(tenantId);
    return ok(data, getRequestIds(req), { page: 1, pageSize: data.length, total: data.length });
  }

  @Post("fleet/vehicles")
  @RequirePermission("industrial.fleet.manage", {
    requiresEntitlement: { productCode: "FORGE_INDUSTRIAL" },
  })
  async createFleetVehicle(
    @Param("tenantId") tenantId: string,
    @Body() body: Record<string, unknown>,
    @Req() req: RequestWithIds,
  ) {
    const input: Parameters<IndustrialService["createFleetVehicle"]>[1] = {};
    if (typeof body.year === "number") input.year = body.year;
    if (typeof body.make === "string") input.make = body.make;
    if (typeof body.model === "string") input.model = body.model;
    if (typeof body.color === "string") input.color = body.color;
    if (typeof body.vin === "string") input.vin = body.vin;
    if (typeof body.licensePlate === "string") input.licensePlate = body.licensePlate;
    if (typeof body.renewalDate === "string") input.renewalDate = body.renewalDate;
    if (typeof body.locationName === "string") input.locationName = body.locationName;
    if (typeof body.countyAssessed === "string") input.countyAssessed = body.countyAssessed;
    if (typeof body.insured === "boolean") input.insured = body.insured;
    if (typeof body.mileage === "number") input.mileage = body.mileage;
    if (typeof body.notes === "string") input.notes = body.notes;
    if (typeof body.vehicleFringe === "boolean") input.vehicleFringe = body.vehicleFringe;
    const data = await this.industrial.createFleetVehicle(tenantId, input);
    return ok(data, getRequestIds(req));
  }

  @Get("fleet/drivers")
  @RequirePermission("industrial.fleet.view", {
    requiresEntitlement: { productCode: "FORGE_INDUSTRIAL" },
  })
  async listFleetDrivers(@Param("tenantId") tenantId: string, @Req() req: RequestWithIds) {
    const data = await this.industrial.listFleetDrivers(tenantId);
    return ok(data, getRequestIds(req), { page: 1, pageSize: data.length, total: data.length });
  }

  @Get("corrective-actions")
  @RequirePermission("industrial.corrective_actions.view", {
    requiresEntitlement: { productCode: "FORGE_INDUSTRIAL" },
  })
  async listCorrectiveActions(@Param("tenantId") tenantId: string, @Req() req: RequestWithIds) {
    const data = await this.industrial.listCorrectiveActions(tenantId);
    return ok(data, getRequestIds(req), { page: 1, pageSize: data.length, total: data.length });
  }

  @Post("corrective-actions")
  @RequirePermission("industrial.corrective_actions.manage", {
    requiresEntitlement: { productCode: "FORGE_INDUSTRIAL" },
  })
  async createCorrectiveAction(
    @Param("tenantId") tenantId: string,
    @Body() body: Record<string, unknown>,
    @Req() req: RequestWithIds,
  ) {
    const input: Parameters<IndustrialService["createCorrectiveAction"]>[1] = {
      title: String(body.title ?? ""),
      parentEntityType: String(body.parentEntityType ?? "UNKNOWN"),
    };
    if (typeof body.parentEntityId === "string") input.parentEntityId = body.parentEntityId;
    if (typeof body.description === "string") input.description = body.description;
    if (typeof body.priority === "string") input.priority = body.priority;
    if (typeof body.dueDate === "string") input.dueDate = body.dueDate;
    const data = await this.industrial.createCorrectiveAction(tenantId, input);
    return ok(data, getRequestIds(req));
  }
}
