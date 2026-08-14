import { Controller, Get, Query, Req } from "@nestjs/common";
import type { ForgePrincipal } from "@forge/tenant-context";
import { ok } from "../../common/api-response.js";
import { getRequestIds, type RequestWithIds } from "../../common/request-ids.js";
import { Principal } from "../auth-context/principal.decorator.js";
import { RequirePermission } from "../auth-context/require-permission.decorator.js";
import { IndustrialAnalyticsService } from "./industrial-analytics.service.js";

type AnalyticsQueryDto = Record<string, string | undefined>;

@Controller("api/v1/industrial/analytics")
export class IndustrialAnalyticsController {
  constructor(private readonly analytics: IndustrialAnalyticsService) {}

  @Get("filter-options")
  @RequirePermission("industrial.access", {
    requiresEntitlement: { productCode: "FORGE_INDUSTRIAL" },
  })
  async filterOptions(
    @Principal() principal: ForgePrincipal,
    @Query() query: AnalyticsQueryDto,
    @Req() req: RequestWithIds,
  ) {
    return ok(await this.analytics.filterOptions(principal, query), getRequestIds(req));
  }

  @Get("overview")
  @RequirePermission("industrial.access", {
    requiresEntitlement: { productCode: "FORGE_INDUSTRIAL" },
  })
  async overview(
    @Principal() principal: ForgePrincipal,
    @Query() query: AnalyticsQueryDto,
    @Req() req: RequestWithIds,
  ) {
    return ok(await this.analytics.overview(principal, query), getRequestIds(req));
  }

  @Get("loto")
  @RequirePermission("industrial.access", {
    requiresEntitlement: { productCode: "FORGE_INDUSTRIAL" },
  })
  async loto(
    @Principal() principal: ForgePrincipal,
    @Query() query: AnalyticsQueryDto,
    @Req() req: RequestWithIds,
  ) {
    return ok(await this.analytics.loto(principal, query), getRequestIds(req));
  }

  @Get("dot")
  @RequirePermission("industrial.access", {
    requiresEntitlement: { productCode: "FORGE_INDUSTRIAL" },
  })
  async dot(
    @Principal() principal: ForgePrincipal,
    @Query() query: AnalyticsQueryDto,
    @Req() req: RequestWithIds,
  ) {
    return ok(await this.analytics.dot(principal, query), getRequestIds(req));
  }

  @Get("personnel")
  @RequirePermission("industrial.access", {
    requiresEntitlement: { productCode: "FORGE_INDUSTRIAL" },
  })
  async personnel(
    @Principal() principal: ForgePrincipal,
    @Query() query: AnalyticsQueryDto,
    @Req() req: RequestWithIds,
  ) {
    return ok(await this.analytics.personnel(principal, query), getRequestIds(req));
  }

  @Get("incidents")
  @RequirePermission("industrial.access", {
    requiresEntitlement: { productCode: "FORGE_INDUSTRIAL" },
  })
  async incidents(
    @Principal() principal: ForgePrincipal,
    @Query() query: AnalyticsQueryDto,
    @Req() req: RequestWithIds,
  ) {
    return ok(await this.analytics.incidents(principal, query), getRequestIds(req));
  }

  @Get("inspections")
  @RequirePermission("industrial.access", {
    requiresEntitlement: { productCode: "FORGE_INDUSTRIAL" },
  })
  async inspections(
    @Principal() principal: ForgePrincipal,
    @Query() query: AnalyticsQueryDto,
    @Req() req: RequestWithIds,
  ) {
    return ok(await this.analytics.inspections(principal, query), getRequestIds(req));
  }

  @Get("workers-comp")
  @RequirePermission("industrial.access", {
    requiresEntitlement: { productCode: "FORGE_INDUSTRIAL" },
  })
  async workersComp(
    @Principal() principal: ForgePrincipal,
    @Query() query: AnalyticsQueryDto,
    @Req() req: RequestWithIds,
  ) {
    return ok(await this.analytics.workersComp(principal, query), getRequestIds(req));
  }

  @Get("intelligence")
  @RequirePermission("industrial.access", {
    requiresEntitlement: { productCode: "FORGE_INDUSTRIAL" },
  })
  async intelligence(
    @Principal() principal: ForgePrincipal,
    @Query() query: AnalyticsQueryDto,
    @Req() req: RequestWithIds,
  ) {
    return ok(await this.analytics.intelligence(principal, query), getRequestIds(req));
  }
}
