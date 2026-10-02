import {Body,Controller,Get,Param,Patch,Post,Query,Req,Res} from "@nestjs/common";
import type {ForgePrincipal} from "@forge/tenant-context";
import type {Response} from "express";
import {ok} from "../../common/api-response.js";
import {requireIfMatch,setETag} from "../../common/concurrency.js";
import {Idempotent} from "../../common/idempotent.decorator.js";
import {getRequestIds,type RequestWithIds} from "../../common/request-ids.js";
import {Principal} from "../auth-context/principal.decorator.js";
import {RequirePermission} from "../auth-context/require-permission.decorator.js";
import {RmsSchedulingService} from "./rms-scheduling.service.js";

@Controller("api/v1/tenants/:tenantId/rms/scheduling/assignments")
export class RmsScheduleAssignmentsController{
 constructor(private readonly service:RmsSchedulingService){}
 @Get() @RequirePermission("rms.masterdata.read")
 async list(@Param("tenantId") tenantId:string,@Query() query:Record<string,string>,@Req() req:RequestWithIds){const r=await this.service.listAssignments(tenantId,query);return ok(r.items,getRequestIds(req),{page:r.page,pageSize:r.pageSize,total:r.total});}
 @Post() @RequirePermission("rms.masterdata.manage") @Idempotent({resourceType:"rms_schedule_assignment"})
 async create(@Param("tenantId") tenantId:string,@Body() body:unknown,@Principal() principal:ForgePrincipal,@Req() req:RequestWithIds,@Res({passthrough:true}) res:Response){const data=await this.service.createAssignment(tenantId,body,principal);setETag(res,data.recordVersion);return ok(data,getRequestIds(req));}
 @Patch(":assignmentId") @RequirePermission("rms.masterdata.manage")
 async patch(@Param("tenantId") tenantId:string,@Param("assignmentId") assignmentId:string,@Body() body:unknown,@Principal() principal:ForgePrincipal,@Req() req:RequestWithIds,@Res({passthrough:true}) res:Response){const expected=requireIfMatch(req,"rms_schedule_assignment");const data=await this.service.patchAssignment(tenantId,assignmentId,body,principal,expected);setETag(res,data.recordVersion);return ok(data,getRequestIds(req));}
}

@Controller("api/v1/tenants/:tenantId/rms/scheduling/time-off")
export class RmsTimeOffController{
 constructor(private readonly service:RmsSchedulingService){}
 @Get() @RequirePermission("rms.masterdata.read")
 async list(@Param("tenantId") tenantId:string,@Query() query:Record<string,string>,@Req() req:RequestWithIds){const r=await this.service.listTimeOff(tenantId,query);return ok(r.items,getRequestIds(req),{page:r.page,pageSize:r.pageSize,total:r.total});}
 @Post() @RequirePermission("rms.masterdata.manage") @Idempotent({resourceType:"rms_time_off_request"})
 async create(@Param("tenantId") tenantId:string,@Body() body:unknown,@Principal() principal:ForgePrincipal,@Req() req:RequestWithIds,@Res({passthrough:true}) res:Response){const data=await this.service.createTimeOff(tenantId,body,principal);setETag(res,data.recordVersion);return ok(data,getRequestIds(req));}
 @Patch(":requestId") @RequirePermission("rms.masterdata.manage")
 async patch(@Param("tenantId") tenantId:string,@Param("requestId") requestId:string,@Body() body:unknown,@Principal() principal:ForgePrincipal,@Req() req:RequestWithIds,@Res({passthrough:true}) res:Response){const expected=requireIfMatch(req,"rms_time_off_request");const data=await this.service.patchTimeOff(tenantId,requestId,body,principal,expected);setETag(res,data.recordVersion);return ok(data,getRequestIds(req));}
}

@Controller("api/v1/tenants/:tenantId/rms/scheduling/swaps")
export class RmsShiftSwapsController{
 constructor(private readonly service:RmsSchedulingService){}
 @Get() @RequirePermission("rms.masterdata.read")
 async list(@Param("tenantId") tenantId:string,@Query() query:Record<string,string>,@Req() req:RequestWithIds){const r=await this.service.listSwaps(tenantId,query);return ok(r.items,getRequestIds(req),{page:r.page,pageSize:r.pageSize,total:r.total});}
 @Post() @RequirePermission("rms.masterdata.manage") @Idempotent({resourceType:"rms_shift_swap_request"})
 async create(@Param("tenantId") tenantId:string,@Body() body:unknown,@Principal() principal:ForgePrincipal,@Req() req:RequestWithIds,@Res({passthrough:true}) res:Response){const data=await this.service.createSwap(tenantId,body,principal);setETag(res,data.recordVersion);return ok(data,getRequestIds(req));}
 @Patch(":swapId") @RequirePermission("rms.masterdata.manage")
 async patch(@Param("tenantId") tenantId:string,@Param("swapId") swapId:string,@Body() body:unknown,@Principal() principal:ForgePrincipal,@Req() req:RequestWithIds,@Res({passthrough:true}) res:Response){const expected=requireIfMatch(req,"rms_shift_swap_request");const data=await this.service.patchSwap(tenantId,swapId,body,principal,expected);setETag(res,data.recordVersion);return ok(data,getRequestIds(req));}
}
