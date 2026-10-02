import { Body, Controller, Get, Param, Patch, Post, Query, Req, Res } from "@nestjs/common";
import type { ForgePrincipal } from "@forge/tenant-context";
import type { Response } from "express";
import { ok } from "../../common/api-response.js";
import { requireIfMatch, setETag } from "../../common/concurrency.js";
import { Idempotent } from "../../common/idempotent.decorator.js";
import { getRequestIds, type RequestWithIds } from "../../common/request-ids.js";
import { Principal } from "../auth-context/principal.decorator.js";
import { RequirePermission } from "../auth-context/require-permission.decorator.js";
import { RmsInspectionsService } from "./rms-inspections.service.js";

@Controller("api/v1/tenants/:tenantId/rms/inspection-programs")
export class RmsInspectionProgramsController{
  constructor(private readonly service:RmsInspectionsService){}
  @Get() @RequirePermission("rms.masterdata.read")
  async list(@Param("tenantId") tenantId:string,@Query() query:Record<string,string>,@Req() req:RequestWithIds){const r=await this.service.listPrograms(tenantId,query);return ok(r.items,getRequestIds(req),{page:r.page,pageSize:r.pageSize,total:r.total});}
  @Post() @RequirePermission("rms.masterdata.manage") @Idempotent({resourceType:"rms_inspection_program"})
  async create(@Param("tenantId") tenantId:string,@Body() body:unknown,@Principal() principal:ForgePrincipal,@Req() req:RequestWithIds){return ok(await this.service.createProgram(tenantId,body,principal),getRequestIds(req));}
  @Patch(":programId") @RequirePermission("rms.masterdata.manage")
  async patch(@Param("tenantId") tenantId:string,@Param("programId") programId:string,@Body() body:unknown,@Principal() principal:ForgePrincipal,@Req() req:RequestWithIds,@Res({passthrough:true}) res:Response){
    const expected=requireIfMatch(req,"rms_inspection_program");const data=await this.service.patchProgram(tenantId,programId,body,principal,expected);setETag(res,data.recordVersion);return ok(data,getRequestIds(req));
  }
}

@Controller("api/v1/tenants/:tenantId/rms/inspection-templates")
export class RmsInspectionTemplatesController{
  constructor(private readonly service:RmsInspectionsService){}
  @Get() @RequirePermission("rms.masterdata.read")
  async list(@Param("tenantId") tenantId:string,@Query() query:Record<string,string>,@Req() req:RequestWithIds){const r=await this.service.listTemplates(tenantId,query);return ok(r.items,getRequestIds(req),{page:r.page,pageSize:r.pageSize,total:r.total});}
  @Post() @RequirePermission("rms.masterdata.manage") @Idempotent({resourceType:"rms_inspection_template"})
  async create(@Param("tenantId") tenantId:string,@Body() body:unknown,@Principal() principal:ForgePrincipal,@Req() req:RequestWithIds){return ok(await this.service.createTemplate(tenantId,body,principal),getRequestIds(req));}
  @Patch(":templateId") @RequirePermission("rms.masterdata.manage")
  async patch(@Param("tenantId") tenantId:string,@Param("templateId") templateId:string,@Body() body:unknown,@Principal() principal:ForgePrincipal,@Req() req:RequestWithIds,@Res({passthrough:true}) res:Response){
    const expected=requireIfMatch(req,"rms_inspection_template");const data=await this.service.patchTemplate(tenantId,templateId,body,principal,expected);setETag(res,data.recordVersion);return ok(data,getRequestIds(req));
  }
}

@Controller("api/v1/tenants/:tenantId/rms/inspections")
export class RmsInspectionsController{
  constructor(private readonly service:RmsInspectionsService){}
  @Get() @RequirePermission("rms.masterdata.read")
  async list(@Param("tenantId") tenantId:string,@Query() query:Record<string,string>,@Req() req:RequestWithIds){const r=await this.service.listInspections(tenantId,query);return ok(r.items,getRequestIds(req),{page:r.page,pageSize:r.pageSize,total:r.total});}

  @Post() @RequirePermission("rms.masterdata.manage") @Idempotent({resourceType:"rms_inspection"})
  async create(@Param("tenantId") tenantId:string,@Body() body:unknown,@Principal() principal:ForgePrincipal,@Req() req:RequestWithIds,@Res({passthrough:true}) res:Response){
    const data=await this.service.createInspection(tenantId,body,principal);setETag(res,data.recordVersion);return ok(data,getRequestIds(req));
  }

  @Get(":inspectionId") @RequirePermission("rms.masterdata.read")
  async get(@Param("tenantId") tenantId:string,@Param("inspectionId") inspectionId:string,@Req() req:RequestWithIds,@Res({passthrough:true}) res:Response){
    const data=await this.service.getInspection(tenantId,inspectionId);setETag(res,data.inspection.recordVersion);return ok(data,getRequestIds(req));
  }

  @Patch(":inspectionId") @RequirePermission("rms.masterdata.manage")
  async patch(@Param("tenantId") tenantId:string,@Param("inspectionId") inspectionId:string,@Body() body:unknown,@Principal() principal:ForgePrincipal,@Req() req:RequestWithIds,@Res({passthrough:true}) res:Response){
    const expected=requireIfMatch(req,"rms_inspection");const data=await this.service.patchInspection(tenantId,inspectionId,body,principal,expected);setETag(res,data.recordVersion);return ok(data,getRequestIds(req));
  }

  @Post(":inspectionId/responses") @RequirePermission("rms.masterdata.manage") @Idempotent({resourceType:"rms_inspection_response"})
  async response(@Param("tenantId") tenantId:string,@Param("inspectionId") inspectionId:string,@Body() body:unknown,@Principal() principal:ForgePrincipal,@Req() req:RequestWithIds){
    return ok(await this.service.upsertResponse(tenantId,inspectionId,body,principal),getRequestIds(req));
  }

  @Post(":inspectionId/findings") @RequirePermission("rms.masterdata.manage") @Idempotent({resourceType:"rms_inspection_finding"})
  async finding(@Param("tenantId") tenantId:string,@Param("inspectionId") inspectionId:string,@Body() body:unknown,@Principal() principal:ForgePrincipal,@Req() req:RequestWithIds){
    return ok(await this.service.createFinding(tenantId,inspectionId,body,principal),getRequestIds(req));
  }
}

@Controller("api/v1/tenants/:tenantId/rms/inspection-findings")
export class RmsInspectionFindingsController{
  constructor(private readonly service:RmsInspectionsService){}
  @Patch(":findingId") @RequirePermission("rms.masterdata.manage")
  async patch(@Param("tenantId") tenantId:string,@Param("findingId") findingId:string,@Body() body:unknown,@Principal() principal:ForgePrincipal,@Req() req:RequestWithIds,@Res({passthrough:true}) res:Response){
    const expected=requireIfMatch(req,"rms_inspection_finding");const data=await this.service.patchFinding(tenantId,findingId,body,principal,expected);setETag(res,data.recordVersion);return ok(data,getRequestIds(req));
  }
}
