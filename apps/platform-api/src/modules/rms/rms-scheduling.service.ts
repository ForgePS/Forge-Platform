import {Inject,Injectable} from "@nestjs/common";
import {
  createId,
  rmsPersonnel,
  rmsScheduleAssignments,
  rmsShiftSwapRequests,
  rmsTimeOffRequests,
  type Database,
  withTenantTransaction,
} from "@forge/database";
import {ForgeError} from "@forge/errors";
import {DOMAIN_EVENT_TYPES} from "@forge/events";
import type {ForgePrincipal} from "@forge/tenant-context";
import {and,count,desc,eq,gt,isNull,lt,ne} from "drizzle-orm";
import {z} from "zod";
import {concurrencyConflict} from "../../common/concurrency.js";
import {DATABASE} from "../../tokens.js";
import {AuditService} from "../audit/audit.service.js";
import {OutboxService} from "../outbox/outbox.service.js";
import {RmsTrainingService} from "./rms-training.service.js";

type ExpectedVersion=number|"*";

const assignmentSchema=z.object({
  personnelId:z.string().uuid(),
  shiftId:z.string().uuid().optional().nullable(),
  stationId:z.string().uuid().optional().nullable(),
  unitId:z.string().uuid().optional().nullable(),
  startAt:z.string().datetime({offset:true}),
  endAt:z.string().datetime({offset:true}),
  assignmentType:z.enum(["DUTY","OVERTIME","TRAINING","ADMIN","CALLBACK"]).default("DUTY"),
  role:z.string().max(80).optional().nullable(),
  status:z.enum(["SCHEDULED","CONFIRMED","CANCELED"]).default("SCHEDULED"),
  notes:z.string().max(12000).optional().nullable(),
});

const timeOffSchema=z.object({
  personnelId:z.string().uuid(),
  startAt:z.string().datetime({offset:true}),
  endAt:z.string().datetime({offset:true}),
  leaveType:z.enum(["VACATION","SICK","KELLY","COMP","FMLA","MILITARY","OTHER"]).default("VACATION"),
  status:z.enum(["PENDING","APPROVED","DENIED","CANCELED"]).default("PENDING"),
  reason:z.string().max(12000).optional().nullable(),
  reviewer:z.string().max(200).optional().nullable(),
  reviewNotes:z.string().max(12000).optional().nullable(),
});

const swapSchema=z.object({
  offeredAssignmentId:z.string().uuid(),
  requesterPersonnelId:z.string().uuid(),
  replacementPersonnelId:z.string().uuid().optional().nullable(),
  targetPersonnelId:z.string().uuid().optional().nullable(),
  status:z.enum(["PENDING","APPROVED","DENIED","CANCELED"]).default("PENDING"),
  reason:z.string().max(12000).optional().nullable(),
  reviewer:z.string().max(200).optional().nullable(),
  reviewNotes:z.string().max(12000).optional().nullable(),
});

function pageQuery(q:Record<string,string>){return {page:Math.max(1,Number(q.page||1)),pageSize:Math.min(200,Math.max(1,Number(q.pageSize||50))),personnelId:String(q.personnelId||""),stationId:String(q.stationId||""),status:String(q.status||""),from:String(q.from||""),to:String(q.to||"")};}

@Injectable()
export class RmsSchedulingService{
  constructor(@Inject(DATABASE) private readonly db:Database,private readonly training:RmsTrainingService,private readonly outbox:OutboxService,private readonly audit:AuditService){}

  async listAssignments(tenantId:string,query:Record<string,string>){
    const q=pageQuery(query);return withTenantTransaction(this.db,tenantId,async tx=>{
      const filters=[eq(rmsScheduleAssignments.tenantId,tenantId),isNull(rmsScheduleAssignments.deletedAt)];
      if(q.personnelId)filters.push(eq(rmsScheduleAssignments.personnelId,q.personnelId));
      if(q.stationId)filters.push(eq(rmsScheduleAssignments.stationId,q.stationId));
      if(q.status)filters.push(eq(rmsScheduleAssignments.status,q.status));
      if(q.from)filters.push(gt(rmsScheduleAssignments.endAt,new Date(q.from)));
      if(q.to)filters.push(lt(rmsScheduleAssignments.startAt,new Date(q.to)));
      const where=and(...filters);const items=await tx.select().from(rmsScheduleAssignments).where(where).orderBy(rmsScheduleAssignments.startAt).limit(q.pageSize).offset((q.page-1)*q.pageSize);const totals=await tx.select({total:count()}).from(rmsScheduleAssignments).where(where);return {items,page:q.page,pageSize:q.pageSize,total:totals[0]?.total??0};
    });
  }

  async createAssignment(tenantId:string,input:unknown,principal:ForgePrincipal){
    const data=assignmentSchema.parse(input);const start=new Date(data.startAt);const end=new Date(data.endAt);if(end<=start)throw new ForgeError("VALIDATION_ERROR","Schedule end must be after start");
    const readiness=await this.training.readiness(tenantId,data.personnelId);
    const warnings=[...readiness.missingTraining.map(x=>`Training: ${x.code} ${x.title}`),...readiness.missingCertifications.map(x=>`Certification: ${x.code} ${x.name}`)];
    return withTenantTransaction(this.db,tenantId,async tx=>{
      await this.requirePersonnel(tx,tenantId,data.personnelId);
      const overlap=await tx.query.rmsScheduleAssignments.findFirst({where:and(eq(rmsScheduleAssignments.tenantId,tenantId),eq(rmsScheduleAssignments.personnelId,data.personnelId),ne(rmsScheduleAssignments.status,"CANCELED"),isNull(rmsScheduleAssignments.deletedAt),lt(rmsScheduleAssignments.startAt,end),gt(rmsScheduleAssignments.endAt,start))});
      if(overlap)throw new ForgeError("VALIDATION_ERROR","Personnel already has an overlapping schedule assignment");
      const leave=await tx.query.rmsTimeOffRequests.findFirst({where:and(eq(rmsTimeOffRequests.tenantId,tenantId),eq(rmsTimeOffRequests.personnelId,data.personnelId),eq(rmsTimeOffRequests.status,"APPROVED"),lt(rmsTimeOffRequests.startAt,end),gt(rmsTimeOffRequests.endAt,start))});
      if(leave)throw new ForgeError("VALIDATION_ERROR","Personnel has approved time off during this assignment");
      const now=new Date();const [row]=await tx.insert(rmsScheduleAssignments).values({id:createId(),tenantId,...data,startAt:start,endAt:end,eligibilityStatus:readiness.eligible?"ELIGIBLE":"NOT_READY",eligibilityWarningsJson:warnings,createdByUserId:principal.userId,updatedByUserId:principal.userId,createdAt:now,updatedAt:now}).returning();if(!row)throw new ForgeError("INTERNAL_ERROR","Failed to create schedule assignment");await this.emit(tx,tenantId,"rms_schedule_assignment",row.id,"create",principal,row);return row;
    },principal.userId);
  }

  async patchAssignment(tenantId:string,id:string,input:unknown,principal:ForgePrincipal,expected:ExpectedVersion){
    const data=assignmentSchema.partial().parse(input);
    const current=await withTenantTransaction(this.db,tenantId,async tx=>{
      const row=await tx.query.rmsScheduleAssignments.findFirst({where:and(eq(rmsScheduleAssignments.tenantId,tenantId),eq(rmsScheduleAssignments.id,id),isNull(rmsScheduleAssignments.deletedAt))});
      if(!row)throw new ForgeError("NOT_FOUND","Schedule assignment not found");
      return row;
    },principal.userId);
    const personnelId=data.personnelId??current.personnelId;
    const readiness=await this.training.readiness(tenantId,personnelId);
    const warnings=[...readiness.missingTraining.map(x=>`Training: ${x.code} ${x.title}`),...readiness.missingCertifications.map(x=>`Certification: ${x.code} ${x.name}`)];
    return withTenantTransaction(this.db,tenantId,async tx=>{
      const before=await tx.query.rmsScheduleAssignments.findFirst({where:and(eq(rmsScheduleAssignments.tenantId,tenantId),eq(rmsScheduleAssignments.id,id),isNull(rmsScheduleAssignments.deletedAt))});
      if(!before)throw new ForgeError("NOT_FOUND","Schedule assignment not found");
      if(expected!=="*"&&before.recordVersion!==expected)throw concurrencyConflict({tenantId,resourceType:"rms_schedule_assignment",resourceId:id,expectedVersion:expected,actualVersion:before.recordVersion});
      const start=data.startAt?new Date(data.startAt):before.startAt;
      const end=data.endAt?new Date(data.endAt):before.endAt;
      if(end<=start)throw new ForgeError("VALIDATION_ERROR","Schedule end must be after start");
      const overlap=await tx.query.rmsScheduleAssignments.findFirst({where:and(eq(rmsScheduleAssignments.tenantId,tenantId),eq(rmsScheduleAssignments.personnelId,personnelId),ne(rmsScheduleAssignments.id,id),ne(rmsScheduleAssignments.status,"CANCELED"),isNull(rmsScheduleAssignments.deletedAt),lt(rmsScheduleAssignments.startAt,end),gt(rmsScheduleAssignments.endAt,start))});
      if(overlap)throw new ForgeError("VALIDATION_ERROR","Personnel already has an overlapping schedule assignment");
      const leave=await tx.query.rmsTimeOffRequests.findFirst({where:and(eq(rmsTimeOffRequests.tenantId,tenantId),eq(rmsTimeOffRequests.personnelId,personnelId),eq(rmsTimeOffRequests.status,"APPROVED"),lt(rmsTimeOffRequests.startAt,end),gt(rmsTimeOffRequests.endAt,start))});
      if(leave)throw new ForgeError("VALIDATION_ERROR","Personnel has approved time off during this assignment");
      const [row]=await tx.update(rmsScheduleAssignments).set({...data,personnelId,startAt:start,endAt:end,eligibilityStatus:readiness.eligible?"ELIGIBLE":"NOT_READY",eligibilityWarningsJson:warnings,recordVersion:before.recordVersion+1,updatedByUserId:principal.userId,updatedAt:new Date()}).where(and(eq(rmsScheduleAssignments.id,id),eq(rmsScheduleAssignments.recordVersion,before.recordVersion))).returning();
      if(!row)throw concurrencyConflict({tenantId,resourceType:"rms_schedule_assignment",resourceId:id,expectedVersion:expected,actualVersion:null});
      await this.emit(tx,tenantId,"rms_schedule_assignment",id,"update",principal,row,before);
      return row;
    },principal.userId);
  }

  async listTimeOff(tenantId:string,query:Record<string,string>){
    const q=pageQuery(query);return withTenantTransaction(this.db,tenantId,async tx=>{const filters=[eq(rmsTimeOffRequests.tenantId,tenantId)];if(q.personnelId)filters.push(eq(rmsTimeOffRequests.personnelId,q.personnelId));if(q.status)filters.push(eq(rmsTimeOffRequests.status,q.status));const where=and(...filters);const items=await tx.select().from(rmsTimeOffRequests).where(where).orderBy(desc(rmsTimeOffRequests.startAt)).limit(q.pageSize).offset((q.page-1)*q.pageSize);const totals=await tx.select({total:count()}).from(rmsTimeOffRequests).where(where);return {items,page:q.page,pageSize:q.pageSize,total:totals[0]?.total??0};});
  }

  async createTimeOff(tenantId:string,input:unknown,principal:ForgePrincipal){
    const data=timeOffSchema.parse(input);const start=new Date(data.startAt);const end=new Date(data.endAt);if(end<=start)throw new ForgeError("VALIDATION_ERROR","Time-off end must be after start");return withTenantTransaction(this.db,tenantId,async tx=>{await this.requirePersonnel(tx,tenantId,data.personnelId);const now=new Date();const [row]=await tx.insert(rmsTimeOffRequests).values({id:createId(),tenantId,...data,startAt:start,endAt:end,reviewedAt:data.status==="APPROVED"||data.status==="DENIED"?now:null,createdByUserId:principal.userId,updatedByUserId:principal.userId,createdAt:now,updatedAt:now}).returning();if(!row)throw new ForgeError("INTERNAL_ERROR","Failed to create time-off request");await this.emit(tx,tenantId,"rms_time_off_request",row.id,"create",principal,row);return row;},principal.userId);
  }

  async patchTimeOff(tenantId:string,id:string,input:unknown,principal:ForgePrincipal,expected:ExpectedVersion){
    const data=timeOffSchema.partial().parse(input);return withTenantTransaction(this.db,tenantId,async tx=>{const before=await tx.query.rmsTimeOffRequests.findFirst({where:and(eq(rmsTimeOffRequests.tenantId,tenantId),eq(rmsTimeOffRequests.id,id))});if(!before)throw new ForgeError("NOT_FOUND","Time-off request not found");if(expected!=="*"&&before.recordVersion!==expected)throw concurrencyConflict({tenantId,resourceType:"rms_time_off_request",resourceId:id,expectedVersion:expected,actualVersion:before.recordVersion});const values:Record<string,unknown>={...data,recordVersion:before.recordVersion+1,updatedByUserId:principal.userId,updatedAt:new Date()};if(data.startAt!==undefined)values.startAt=new Date(data.startAt);if(data.endAt!==undefined)values.endAt=new Date(data.endAt);if(data.status==="APPROVED"||data.status==="DENIED")values.reviewedAt=new Date();const [row]=await tx.update(rmsTimeOffRequests).set(values as never).where(and(eq(rmsTimeOffRequests.id,id),eq(rmsTimeOffRequests.recordVersion,before.recordVersion))).returning();if(!row)throw concurrencyConflict({tenantId,resourceType:"rms_time_off_request",resourceId:id,expectedVersion:expected,actualVersion:null});await this.emit(tx,tenantId,"rms_time_off_request",id,"update",principal,row,before);return row;},principal.userId);
  }

  async listSwaps(tenantId:string,query:Record<string,string>){
    const q=pageQuery(query);return withTenantTransaction(this.db,tenantId,async tx=>{const filters=[eq(rmsShiftSwapRequests.tenantId,tenantId)];if(q.status)filters.push(eq(rmsShiftSwapRequests.status,q.status));const where=and(...filters);const items=await tx.select().from(rmsShiftSwapRequests).where(where).orderBy(desc(rmsShiftSwapRequests.createdAt)).limit(q.pageSize).offset((q.page-1)*q.pageSize);const totals=await tx.select({total:count()}).from(rmsShiftSwapRequests).where(where);return {items,page:q.page,pageSize:q.pageSize,total:totals[0]?.total??0};});
  }

  async createSwap(tenantId:string,input:unknown,principal:ForgePrincipal){
    const data=swapSchema.parse(input);return withTenantTransaction(this.db,tenantId,async tx=>{await this.requirePersonnel(tx,tenantId,data.requesterPersonnelId);if(data.replacementPersonnelId)await this.requirePersonnel(tx,tenantId,data.replacementPersonnelId);const assignment=await tx.query.rmsScheduleAssignments.findFirst({where:and(eq(rmsScheduleAssignments.tenantId,tenantId),eq(rmsScheduleAssignments.id,data.offeredAssignmentId),isNull(rmsScheduleAssignments.deletedAt))});if(!assignment)throw new ForgeError("NOT_FOUND","Offered schedule assignment not found");if(assignment.personnelId!==data.requesterPersonnelId)throw new ForgeError("VALIDATION_ERROR","Requester does not own the offered assignment");const now=new Date();const [row]=await tx.insert(rmsShiftSwapRequests).values({id:createId(),tenantId,...data,reviewedAt:data.status==="APPROVED"||data.status==="DENIED"?now:null,createdByUserId:principal.userId,updatedByUserId:principal.userId,createdAt:now,updatedAt:now}).returning();if(!row)throw new ForgeError("INTERNAL_ERROR","Failed to create shift swap request");await this.emit(tx,tenantId,"rms_shift_swap_request",row.id,"create",principal,row);return row;},principal.userId);
  }

  async patchSwap(tenantId:string,id:string,input:unknown,principal:ForgePrincipal,expected:ExpectedVersion){
    const data=swapSchema.partial().parse(input);
    const current=await withTenantTransaction(this.db,tenantId,async tx=>{
      const swap=await tx.query.rmsShiftSwapRequests.findFirst({where:and(eq(rmsShiftSwapRequests.tenantId,tenantId),eq(rmsShiftSwapRequests.id,id))});
      if(!swap)throw new ForgeError("NOT_FOUND","Shift swap request not found");
      const assignment=await tx.query.rmsScheduleAssignments.findFirst({where:and(eq(rmsScheduleAssignments.tenantId,tenantId),eq(rmsScheduleAssignments.id,swap.offeredAssignmentId),isNull(rmsScheduleAssignments.deletedAt))});
      if(!assignment)throw new ForgeError("NOT_FOUND","Offered schedule assignment not found");
      return {swap,assignment};
    },principal.userId);
    const nextReplacement=data.replacementPersonnelId??current.swap.replacementPersonnelId;
    let readiness:null|Awaited<ReturnType<RmsTrainingService["readiness"]>>=null;
    if(data.status==="APPROVED"){
      if(!nextReplacement)throw new ForgeError("VALIDATION_ERROR","Approved swap requires a replacement person");
      readiness=await this.training.readiness(tenantId,nextReplacement);
    }
    return withTenantTransaction(this.db,tenantId,async tx=>{
      const before=await tx.query.rmsShiftSwapRequests.findFirst({where:and(eq(rmsShiftSwapRequests.tenantId,tenantId),eq(rmsShiftSwapRequests.id,id))});
      if(!before)throw new ForgeError("NOT_FOUND","Shift swap request not found");
      if(expected!=="*"&&before.recordVersion!==expected)throw concurrencyConflict({tenantId,resourceType:"rms_shift_swap_request",resourceId:id,expectedVersion:expected,actualVersion:before.recordVersion});
      const assignment=await tx.query.rmsScheduleAssignments.findFirst({where:and(eq(rmsScheduleAssignments.tenantId,tenantId),eq(rmsScheduleAssignments.id,before.offeredAssignmentId),isNull(rmsScheduleAssignments.deletedAt))});
      if(!assignment)throw new ForgeError("NOT_FOUND","Offered schedule assignment not found");
      if(data.status==="APPROVED"&&nextReplacement){
        const overlap=await tx.query.rmsScheduleAssignments.findFirst({where:and(eq(rmsScheduleAssignments.tenantId,tenantId),eq(rmsScheduleAssignments.personnelId,nextReplacement),ne(rmsScheduleAssignments.id,assignment.id),ne(rmsScheduleAssignments.status,"CANCELED"),isNull(rmsScheduleAssignments.deletedAt),lt(rmsScheduleAssignments.startAt,assignment.endAt),gt(rmsScheduleAssignments.endAt,assignment.startAt))});
        if(overlap)throw new ForgeError("VALIDATION_ERROR","Replacement personnel already has an overlapping schedule assignment");
        const leave=await tx.query.rmsTimeOffRequests.findFirst({where:and(eq(rmsTimeOffRequests.tenantId,tenantId),eq(rmsTimeOffRequests.personnelId,nextReplacement),eq(rmsTimeOffRequests.status,"APPROVED"),lt(rmsTimeOffRequests.startAt,assignment.endAt),gt(rmsTimeOffRequests.endAt,assignment.startAt))});
        if(leave)throw new ForgeError("VALIDATION_ERROR","Replacement personnel has approved time off during the offered assignment");
      }
      const now=new Date();
      const values:Record<string,unknown>={...data,recordVersion:before.recordVersion+1,updatedByUserId:principal.userId,updatedAt:now};
      if(data.status==="APPROVED"||data.status==="DENIED")values.reviewedAt=now;
      const [row]=await tx.update(rmsShiftSwapRequests).set(values as never).where(and(eq(rmsShiftSwapRequests.id,id),eq(rmsShiftSwapRequests.recordVersion,before.recordVersion))).returning();
      if(!row)throw concurrencyConflict({tenantId,resourceType:"rms_shift_swap_request",resourceId:id,expectedVersion:expected,actualVersion:null});
      if(data.status==="APPROVED"&&nextReplacement){
        const warnings=readiness?[...readiness.missingTraining.map(x=>`Training: ${x.code} ${x.title}`),...readiness.missingCertifications.map(x=>`Certification: ${x.code} ${x.name}`)]:[];
        const [updatedAssignment]=await tx.update(rmsScheduleAssignments).set({personnelId:nextReplacement,eligibilityStatus:readiness?.eligible?"ELIGIBLE":"NOT_READY",eligibilityWarningsJson:warnings,recordVersion:assignment.recordVersion+1,updatedByUserId:principal.userId,updatedAt:now}).where(and(eq(rmsScheduleAssignments.id,assignment.id),eq(rmsScheduleAssignments.recordVersion,assignment.recordVersion))).returning();
        if(!updatedAssignment)throw concurrencyConflict({tenantId,resourceType:"rms_schedule_assignment",resourceId:assignment.id,expectedVersion:assignment.recordVersion,actualVersion:null});
      }
      await this.emit(tx,tenantId,"rms_shift_swap_request",id,"update",principal,row,before);
      return row;
    },principal.userId);
  }

  private async requirePersonnel(tx:Parameters<Parameters<typeof withTenantTransaction>[2]>[0],tenantId:string,personnelId:string){const row=await tx.query.rmsPersonnel.findFirst({where:and(eq(rmsPersonnel.tenantId,tenantId),eq(rmsPersonnel.id,personnelId),isNull(rmsPersonnel.deletedAt))});if(!row)throw new ForgeError("NOT_FOUND","Personnel record not found");return row;}

  private async emit(tx:Parameters<Parameters<typeof withTenantTransaction>[2]>[0],tenantId:string,resourceType:string,resourceId:string,action:string,principal:ForgePrincipal,after?:unknown,before?:unknown){
    await this.outbox.write(tx,{tenantId,aggregateType:resourceType,aggregateId:resourceId,eventType:DOMAIN_EVENT_TYPES.RMS_MASTERDATA_UPDATED,payload:{tenantId,resourceType,resourceId,action},correlationId:principal.correlationId,actorUserId:principal.userId});
    await this.audit.writeInTransaction(tx,{tenantId,actorUserId:principal.userId,actorPersonId:principal.personId,actorType:"USER",action:`rms.scheduling.${action}`,resourceType,resourceId,result:"SUCCESS",riskLevel:"MEDIUM",correlationId:principal.correlationId,requestId:principal.requestId,before,after});
  }
}
