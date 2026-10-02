import { Body, Controller, Get, Param, Patch, Post, Query, Req, Res } from "@nestjs/common";
import type { ForgePrincipal } from "@forge/tenant-context";
import type { Response } from "express";
import { ok } from "../../common/api-response.js";
import { requireIfMatch, setETag } from "../../common/concurrency.js";
import { Idempotent } from "../../common/idempotent.decorator.js";
import { getRequestIds, type RequestWithIds } from "../../common/request-ids.js";
import { Principal } from "../auth-context/principal.decorator.js";
import { RequirePermission } from "../auth-context/require-permission.decorator.js";
import { RmsCodeEnforcementService } from "./rms-code-enforcement.service.js";

@Controller("api/v1/tenants/:tenantId/rms/code-cases")
export class RmsCodeCasesController{
  constructor(private readonly service:RmsCodeEnforcementService){}

  @Get() @RequirePermission("rms.masterdata.read")
  async list(@Param("tenantId") tenantId:string,@Query() query:Record<string,string>,@Req() req:RequestWithIds){
    const r=await this.service.listCases(tenantId,query);return ok(r.items,getRequestIds(req),{page:r.page,pageSize:r.pageSize,total:r.total});
  }

  @Post() @RequirePermission("rms.masterdata.manage") @Idempotent({resourceType:"rms_code_case"})
  async create(@Param("tenantId") tenantId:string,@Body() body:unknown,@Principal() principal:ForgePrincipal,@Req() req:RequestWithIds,@Res({passthrough:true}) res:Response){
    const data=await this.service.createCase(tenantId,body,principal);setETag(res,data.recordVersion);return ok(data,getRequestIds(req));
  }

  @Post("from-finding/:findingId") @RequirePermission("rms.masterdata.manage") @Idempotent({resourceType:"rms_code_case_from_finding"})
  async fromFinding(@Param("tenantId") tenantId:string,@Param("findingId") findingId:string,@Principal() principal:ForgePrincipal,@Req() req:RequestWithIds){
    return ok(await this.service.createFromFinding(tenantId,findingId,principal),getRequestIds(req));
  }

  @Get(":caseId") @RequirePermission("rms.masterdata.read")
  async get(@Param("tenantId") tenantId:string,@Param("caseId") caseId:string,@Req() req:RequestWithIds,@Res({passthrough:true}) res:Response){
    const data=await this.service.getCase(tenantId,caseId);setETag(res,data.case.recordVersion);return ok(data,getRequestIds(req));
  }

  @Patch(":caseId") @RequirePermission("rms.masterdata.manage")
  async patch(@Param("tenantId") tenantId:string,@Param("caseId") caseId:string,@Body() body:unknown,@Principal() principal:ForgePrincipal,@Req() req:RequestWithIds,@Res({passthrough:true}) res:Response){
    const expected=requireIfMatch(req,"rms_code_case");const data=await this.service.patchCase(tenantId,caseId,body,principal,expected);setETag(res,data.recordVersion);return ok(data,getRequestIds(req));
  }

  @Post(":caseId/violations") @RequirePermission("rms.masterdata.manage") @Idempotent({resourceType:"rms_code_violation"})
  async violation(@Param("tenantId") tenantId:string,@Param("caseId") caseId:string,@Body() body:unknown,@Principal() principal:ForgePrincipal,@Req() req:RequestWithIds){
    return ok(await this.service.createViolation(tenantId,caseId,body,principal),getRequestIds(req));
  }

  @Post(":caseId/notices") @RequirePermission("rms.masterdata.manage") @Idempotent({resourceType:"rms_code_notice"})
  async notice(@Param("tenantId") tenantId:string,@Param("caseId") caseId:string,@Body() body:unknown,@Principal() principal:ForgePrincipal,@Req() req:RequestWithIds){
    return ok(await this.service.issueNotice(tenantId,caseId,body,principal),getRequestIds(req));
  }
}

@Controller("api/v1/tenants/:tenantId/rms/code-violations")
export class RmsCodeViolationsController{
  constructor(private readonly service:RmsCodeEnforcementService){}
  @Patch(":violationId") @RequirePermission("rms.masterdata.manage")
  async patch(@Param("tenantId") tenantId:string,@Param("violationId") violationId:string,@Body() body:unknown,@Principal() principal:ForgePrincipal,@Req() req:RequestWithIds,@Res({passthrough:true}) res:Response){
    const expected=requireIfMatch(req,"rms_code_violation");const data=await this.service.patchViolation(tenantId,violationId,body,principal,expected);setETag(res,data.recordVersion);return ok(data,getRequestIds(req));
  }
}
