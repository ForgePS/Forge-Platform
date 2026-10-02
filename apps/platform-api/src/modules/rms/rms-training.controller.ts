import {Body,Controller,Get,Param,Patch,Post,Query,Req,Res} from "@nestjs/common";
import type {ForgePrincipal} from "@forge/tenant-context";
import type {Response} from "express";
import {ok} from "../../common/api-response.js";
import {requireIfMatch,setETag} from "../../common/concurrency.js";
import {Idempotent} from "../../common/idempotent.decorator.js";
import {getRequestIds,type RequestWithIds} from "../../common/request-ids.js";
import {Principal} from "../auth-context/principal.decorator.js";
import {RequirePermission} from "../auth-context/require-permission.decorator.js";
import {RmsTrainingService} from "./rms-training.service.js";

@Controller("api/v1/tenants/:tenantId/rms/training/courses")
export class RmsTrainingCoursesController{
  constructor(private readonly service:RmsTrainingService){}
  @Get() @RequirePermission("rms.masterdata.read")
  async list(@Param("tenantId") tenantId:string,@Query() query:Record<string,string>,@Req() req:RequestWithIds){const r=await this.service.listCourses(tenantId,query);return ok(r.items,getRequestIds(req),{page:r.page,pageSize:r.pageSize,total:r.total});}
  @Post() @RequirePermission("rms.masterdata.manage") @Idempotent({resourceType:"rms_training_course"})
  async create(@Param("tenantId") tenantId:string,@Body() body:unknown,@Principal() principal:ForgePrincipal,@Req() req:RequestWithIds,@Res({passthrough:true}) res:Response){const data=await this.service.createCourse(tenantId,body,principal);setETag(res,data.recordVersion);return ok(data,getRequestIds(req));}
  @Patch(":courseId") @RequirePermission("rms.masterdata.manage")
  async patch(@Param("tenantId") tenantId:string,@Param("courseId") courseId:string,@Body() body:unknown,@Principal() principal:ForgePrincipal,@Req() req:RequestWithIds,@Res({passthrough:true}) res:Response){const expected=requireIfMatch(req,"rms_training_course");const data=await this.service.patchCourse(tenantId,courseId,body,principal,expected);setETag(res,data.recordVersion);return ok(data,getRequestIds(req));}
}

@Controller("api/v1/tenants/:tenantId/rms/training/records")
export class RmsTrainingRecordsController{
  constructor(private readonly service:RmsTrainingService){}
  @Get() @RequirePermission("rms.masterdata.read")
  async list(@Param("tenantId") tenantId:string,@Query() query:Record<string,string>,@Req() req:RequestWithIds){const r=await this.service.listTrainingRecords(tenantId,query);return ok(r.items,getRequestIds(req),{page:r.page,pageSize:r.pageSize,total:r.total});}
  @Post() @RequirePermission("rms.masterdata.manage") @Idempotent({resourceType:"rms_training_record"})
  async create(@Param("tenantId") tenantId:string,@Body() body:unknown,@Principal() principal:ForgePrincipal,@Req() req:RequestWithIds){return ok(await this.service.createTrainingRecord(tenantId,body,principal),getRequestIds(req));}
}

@Controller("api/v1/tenants/:tenantId/rms/certifications/types")
export class RmsCertificationTypesController{
  constructor(private readonly service:RmsTrainingService){}
  @Get() @RequirePermission("rms.masterdata.read")
  async list(@Param("tenantId") tenantId:string,@Query() query:Record<string,string>,@Req() req:RequestWithIds){const r=await this.service.listCertificationTypes(tenantId,query);return ok(r.items,getRequestIds(req),{page:r.page,pageSize:r.pageSize,total:r.total});}
  @Post() @RequirePermission("rms.masterdata.manage") @Idempotent({resourceType:"rms_certification_type"})
  async create(@Param("tenantId") tenantId:string,@Body() body:unknown,@Principal() principal:ForgePrincipal,@Req() req:RequestWithIds,@Res({passthrough:true}) res:Response){const data=await this.service.createCertificationType(tenantId,body,principal);setETag(res,data.recordVersion);return ok(data,getRequestIds(req));}
  @Patch(":typeId") @RequirePermission("rms.masterdata.manage")
  async patch(@Param("tenantId") tenantId:string,@Param("typeId") typeId:string,@Body() body:unknown,@Principal() principal:ForgePrincipal,@Req() req:RequestWithIds,@Res({passthrough:true}) res:Response){const expected=requireIfMatch(req,"rms_certification_type");const data=await this.service.patchCertificationType(tenantId,typeId,body,principal,expected);setETag(res,data.recordVersion);return ok(data,getRequestIds(req));}
}

@Controller("api/v1/tenants/:tenantId/rms/certifications/personnel")
export class RmsPersonnelCertificationsController{
  constructor(private readonly service:RmsTrainingService){}
  @Get() @RequirePermission("rms.masterdata.read")
  async list(@Param("tenantId") tenantId:string,@Query() query:Record<string,string>,@Req() req:RequestWithIds){const r=await this.service.listPersonnelCertifications(tenantId,query);return ok(r.items,getRequestIds(req),{page:r.page,pageSize:r.pageSize,total:r.total});}
  @Post() @RequirePermission("rms.masterdata.manage") @Idempotent({resourceType:"rms_personnel_certification"})
  async create(@Param("tenantId") tenantId:string,@Body() body:unknown,@Principal() principal:ForgePrincipal,@Req() req:RequestWithIds,@Res({passthrough:true}) res:Response){const data=await this.service.createPersonnelCertification(tenantId,body,principal);setETag(res,data.recordVersion);return ok(data,getRequestIds(req));}
  @Patch(":certificationId") @RequirePermission("rms.masterdata.manage")
  async patch(@Param("tenantId") tenantId:string,@Param("certificationId") certificationId:string,@Body() body:unknown,@Principal() principal:ForgePrincipal,@Req() req:RequestWithIds,@Res({passthrough:true}) res:Response){const expected=requireIfMatch(req,"rms_personnel_certification");const data=await this.service.patchPersonnelCertification(tenantId,certificationId,body,principal,expected);setETag(res,data.recordVersion);return ok(data,getRequestIds(req));}
}

@Controller("api/v1/tenants/:tenantId/rms/training/readiness")
export class RmsTrainingReadinessController{
  constructor(private readonly service:RmsTrainingService){}
  @Get(":personnelId") @RequirePermission("rms.masterdata.read")
  async get(@Param("tenantId") tenantId:string,@Param("personnelId") personnelId:string,@Req() req:RequestWithIds){return ok(await this.service.readiness(tenantId,personnelId),getRequestIds(req));}
}
