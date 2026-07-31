import { Controller, Get, Param, Post, Query, Req } from "@nestjs/common";
import { ForgeError } from "@forge/errors";
import { ok } from "../../common/api-response.js";
import { getRequestIds, type RequestWithIds } from "../../common/request-ids.js";
import { RequireAnyPermission, RequirePermission } from "../auth-context/require-permission.decorator.js";
import { AuditService } from "./audit.service.js";

@Controller("api/v1/tenants/:tenantId/audit-events")
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @RequireAnyPermission(["platform.audit.read", "rms.neris.audit.view"])
  async list(
    @Param("tenantId") tenantId: string,
    @Query("page") pageRaw: string | undefined,
    @Query("pageSize") pageSizeRaw: string | undefined,
    @Req() req: RequestWithIds,
  ) {
    const page = Math.max(1, Number(pageRaw ?? 1) || 1);
    const pageSize = Math.min(200, Math.max(1, Number(pageSizeRaw ?? 25) || 25));
    const rows = await this.audit.list(tenantId, page, pageSize);
    return ok(rows, getRequestIds(req), {
      page,
      pageSize,
      total: rows.length,
    });
  }

  @Get(":auditEventId")
  @RequireAnyPermission(["platform.audit.read", "rms.neris.audit.view"])
  async get(
    @Param("tenantId") tenantId: string,
    @Param("auditEventId") auditEventId: string,
    @Req() req: RequestWithIds,
  ) {
    const row = await this.audit.getById(tenantId, auditEventId);
    if (!row) {
      throw new ForgeError("NOT_FOUND", "Audit event not found");
    }
    return ok(row, getRequestIds(req));
  }

  @Post("export")
  @RequirePermission("platform.audit.read")
  async export(@Param("tenantId") tenantId: string, @Req() req: RequestWithIds) {
    const rows = await this.audit.list(tenantId, 1, 200);
    return ok(
      {
        format: "json",
        exportedAt: new Date().toISOString(),
        count: rows.length,
        events: rows,
      },
      getRequestIds(req),
    );
  }
}
