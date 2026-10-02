import { Body, Controller, Get, Param, Patch, Post, Query, Req, Res } from "@nestjs/common";
import type { ForgePrincipal } from "@forge/tenant-context";
import type { Response } from "express";
import { ok } from "../../common/api-response.js";
import { requireIfMatch, setETag } from "../../common/concurrency.js";
import { Idempotent } from "../../common/idempotent.decorator.js";
import { getRequestIds, type RequestWithIds } from "../../common/request-ids.js";
import { Principal } from "../auth-context/principal.decorator.js";
import { RequirePermission } from "../auth-context/require-permission.decorator.js";
import { RmsInvestigationsService } from "./rms-investigations.service.js";

@Controller("api/v1/tenants/:tenantId/rms/investigations")
export class RmsInvestigationsController{
  constructor(private readonly service:RmsInvestigationsService){}

  @Get() @RequirePermission("rms.masterdata.read")
  async list(@Param("tenantId") tenantId:string,@Query() query:Record<string,string>,@Req() req:RequestWithIds){
    const r=await this.service.listCases(tenantId,query);return ok(r.items,getRequestIds(req),{page:r.page,pageSize:r.pageSize,total:r.total});
  }

  @Post() @RequirePermission("rms.masterdata.manage") @Idempotent({resourceType:"rms_investigation_case"})
  async create(@Param("tenantId") tenantId:string,@Body() body:unknown,@Principal() principal:ForgePrincipal,@Req() req:RequestWithIds,@Res({passthrough:true}) res:Response){
    const data=await this.service.createCase(tenantId,body,principal);setETag(res,data.recordVersion);return ok(data,getRequestIds(req));
  }

  @Get(":caseId") @RequirePermission("rms.masterdata.read")
  async get(@Param("tenantId") tenantId:string,@Param("caseId") caseId:string,@Req() req:RequestWithIds,@Res({passthrough:true}) res:Response){
    const data=await this.service.getCase(tenantId,caseId);setETag(res,data.case.recordVersion);return ok(data,getRequestIds(req));
  }

  @Patch(":caseId") @RequirePermission("rms.masterdata.manage")
  async patch(@Param("tenantId") tenantId:string,@Param("caseId") caseId:string,@Body() body:unknown,@Principal() principal:ForgePrincipal,@Req() req:RequestWithIds,@Res({passthrough:true}) res:Response){
    const expected=requireIfMatch(req,"rms_investigation_case");const data=await this.service.patchCase(tenantId,caseId,body,principal,expected);setETag(res,data.recordVersion);return ok(data,getRequestIds(req));
  }

  @Post(":caseId/evidence") @RequirePermission("rms.masterdata.manage") @Idempotent({resourceType:"rms_investigation_evidence"})
  async evidence(@Param("tenantId") tenantId:string,@Param("caseId") caseId:string,@Body() body:unknown,@Principal() principal:ForgePrincipal,@Req() req:RequestWithIds){
    return ok(await this.service.createEvidence(tenantId,caseId,body,principal),getRequestIds(req));
  }
}

@Controller("api/v1/tenants/:tenantId/rms/investigation-evidence")
export class RmsInvestigationEvidenceController{
  constructor(private readonly service:RmsInvestigationsService){}

  @Patch(":evidenceId") @RequirePermission("rms.masterdata.manage")
  async patch(@Param("tenantId") tenantId:string,@Param("evidenceId") evidenceId:string,@Body() body:unknown,@Principal() principal:ForgePrincipal,@Req() req:RequestWithIds,@Res({passthrough:true}) res:Response){
    const expected=requireIfMatch(req,"rms_investigation_evidence");const data=await this.service.patchEvidence(tenantId,evidenceId,body,principal,expected);setETag(res,data.recordVersion);return ok(data,getRequestIds(req));
  }

  @Post(":evidenceId/custody-events") @RequirePermission("rms.masterdata.manage") @Idempotent({resourceType:"rms_investigation_custody_event"})
  async custody(@Param("tenantId") tenantId:string,@Param("evidenceId") evidenceId:string,@Body() body:unknown,@Principal() principal:ForgePrincipal,@Req() req:RequestWithIds){
    return ok(await this.service.addCustodyEvent(tenantId,evidenceId,body,principal),getRequestIds(req));
  }
}
