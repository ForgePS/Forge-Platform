import { Inject, Injectable } from "@nestjs/common";
import {
  createId,
  rmsCodeCases,
  rmsCodeNotices,
  rmsCodeViolations,
  rmsInspectionFindings,
  rmsInspections,
  rmsOccupancies,
  type Database,
  withTenantTransaction,
} from "@forge/database";
import { ForgeError } from "@forge/errors";
import { DOMAIN_EVENT_TYPES } from "@forge/events";
import type { ForgePrincipal } from "@forge/tenant-context";
import { and, count, desc, eq, ilike, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { concurrencyConflict } from "../../common/concurrency.js";
import { DATABASE } from "../../tokens.js";
import { AuditService } from "../audit/audit.service.js";
import { OutboxService } from "../outbox/outbox.service.js";

type ExpectedVersion=number|"*";

const caseSchema=z.object({
  occupancyId:z.string().uuid(),
  inspectionId:z.string().uuid().optional().nullable(),
  caseType:z.enum(["VIOLATION","COMPLAINT","ORDER","CITATION"]).default("VIOLATION"),
  status:z.enum(["OPEN","NOTICE_ISSUED","COMPLIANCE_PENDING","HEARING","CLOSED","VOID"]).default("OPEN"),
  complianceDueDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  responsibleParty:z.string().max(200).optional().nullable(),
  contactEmail:z.string().email().max(320).optional().nullable(),
  contactPhone:z.string().max(64).optional().nullable(),
  summary:z.string().max(12000).optional().nullable(),
  notes:z.string().max(12000).optional().nullable(),
});

const violationSchema=z.object({
  inspectionFindingId:z.string().uuid().optional().nullable(),
  codeReference:z.string().max(160).optional().nullable(),
  title:z.string().min(1).max(300),
  description:z.string().max(12000).optional().nullable(),
  severity:z.enum(["LOW","MODERATE","HIGH","CRITICAL"]).default("MODERATE"),
  status:z.enum(["OPEN","CORRECTED","VERIFIED","VOID"]).default("OPEN"),
  correctiveAction:z.string().max(12000).optional().nullable(),
  correctionDueDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  verificationNotes:z.string().max(12000).optional().nullable(),
  fineAmount:z.number().nonnegative().optional().nullable(),
});

const noticeSchema=z.object({
  noticeType:z.enum(["WARNING","NOTICE_OF_VIOLATION","ORDER_TO_CORRECT","CITATION"]).default("NOTICE_OF_VIOLATION"),
  issuedAt:z.string().datetime({offset:true}).optional(),
  recipient:z.string().max(300).optional().nullable(),
  deliveryMethod:z.enum(["IN_PERSON","EMAIL","MAIL","POSTED","OTHER"]).optional().nullable(),
  servedAt:z.string().datetime({offset:true}).optional().nullable(),
  subject:z.string().max(300).optional().nullable(),
  bodySnapshot:z.string().min(1).max(50000),
});

function queryPage(input:Record<string,string>){
  return {page:Math.max(1,Number(input.page||1)),pageSize:Math.min(200,Math.max(1,Number(input.pageSize||50))),search:String(input.search||"").trim(),status:String(input.status||"").trim()};
}

@Injectable()
export class RmsCodeEnforcementService{
  constructor(@Inject(DATABASE) private readonly db:Database,private readonly outbox:OutboxService,private readonly audit:AuditService){}

  async listCases(tenantId:string,query:Record<string,string>){
    const q=queryPage(query);return withTenantTransaction(this.db,tenantId,async tx=>{
      const filters=[eq(rmsCodeCases.tenantId,tenantId),isNull(rmsCodeCases.deletedAt)];
      if(q.status)filters.push(eq(rmsCodeCases.status,q.status));
      if(q.search)filters.push(or(ilike(rmsCodeCases.caseNumber,`%${q.search}%`),ilike(rmsCodeCases.responsibleParty,`%${q.search}%`),ilike(rmsCodeCases.summary,`%${q.search}%`))!);
      const where=and(...filters);const items=await tx.select().from(rmsCodeCases).where(where).orderBy(desc(rmsCodeCases.openedAt)).limit(q.pageSize).offset((q.page-1)*q.pageSize);
      const totals=await tx.select({total:count()}).from(rmsCodeCases).where(where);return {items,page:q.page,pageSize:q.pageSize,total:totals[0]?.total??0};
    });
  }

  async getCase(tenantId:string,id:string){
    return withTenantTransaction(this.db,tenantId,async tx=>{
      const record=await tx.query.rmsCodeCases.findFirst({where:and(eq(rmsCodeCases.tenantId,tenantId),eq(rmsCodeCases.id,id),isNull(rmsCodeCases.deletedAt))});
      if(!record)throw new ForgeError("NOT_FOUND","Code enforcement case not found");
      const [violations,notices]=await Promise.all([
        tx.query.rmsCodeViolations.findMany({where:and(eq(rmsCodeViolations.tenantId,tenantId),eq(rmsCodeViolations.caseId,id)),orderBy:[desc(rmsCodeViolations.createdAt)]}),
        tx.query.rmsCodeNotices.findMany({where:and(eq(rmsCodeNotices.tenantId,tenantId),eq(rmsCodeNotices.caseId,id)),orderBy:[desc(rmsCodeNotices.issuedAt)]}),
      ]);
      return {case:record,violations,notices};
    });
  }

  async createCase(tenantId:string,input:unknown,principal:ForgePrincipal){
    const data=caseSchema.parse(input);return withTenantTransaction(this.db,tenantId,async tx=>{
      const occupancy=await tx.query.rmsOccupancies.findFirst({where:and(eq(rmsOccupancies.tenantId,tenantId),eq(rmsOccupancies.id,data.occupancyId),isNull(rmsOccupancies.deletedAt))});if(!occupancy)throw new ForgeError("NOT_FOUND","Occupancy not found");
      if(data.inspectionId){const inspection=await tx.query.rmsInspections.findFirst({where:and(eq(rmsInspections.tenantId,tenantId),eq(rmsInspections.id,data.inspectionId),isNull(rmsInspections.deletedAt))});if(!inspection)throw new ForgeError("NOT_FOUND","Inspection not found");}
      const id=createId();const now=new Date();const caseNumber=`CE-${now.getUTCFullYear()}-${id.slice(0,8).toUpperCase()}`;
      const [row]=await tx.insert(rmsCodeCases).values({id,tenantId,caseNumber,...data,openedAt:now,closedAt:data.status==="CLOSED"?now:null,createdByUserId:principal.userId,updatedByUserId:principal.userId,createdAt:now,updatedAt:now}).returning();
      if(!row)throw new ForgeError("INTERNAL_ERROR","Failed to create code enforcement case");await this.emit(tx,tenantId,"rms_code_case",id,"create",principal,row);return row;
    },principal.userId);
  }

  async createFromFinding(tenantId:string,findingId:string,principal:ForgePrincipal){
    return withTenantTransaction(this.db,tenantId,async tx=>{
      const finding=await tx.query.rmsInspectionFindings.findFirst({where:and(eq(rmsInspectionFindings.tenantId,tenantId),eq(rmsInspectionFindings.id,findingId))});if(!finding)throw new ForgeError("NOT_FOUND","Inspection finding not found");
      const existingViolation=await tx.query.rmsCodeViolations.findFirst({where:and(eq(rmsCodeViolations.tenantId,tenantId),eq(rmsCodeViolations.inspectionFindingId,findingId))});
      if(existingViolation){const existingCase=await tx.query.rmsCodeCases.findFirst({where:and(eq(rmsCodeCases.tenantId,tenantId),eq(rmsCodeCases.id,existingViolation.caseId),isNull(rmsCodeCases.deletedAt))});if(existingCase)return {case:existingCase,violation:existingViolation,existing:true};}
      const inspection=await tx.query.rmsInspections.findFirst({where:and(eq(rmsInspections.tenantId,tenantId),eq(rmsInspections.id,finding.inspectionId),isNull(rmsInspections.deletedAt))});if(!inspection)throw new ForgeError("NOT_FOUND","Inspection not found");
      const now=new Date();const caseId=createId();const caseNumber=`CE-${now.getUTCFullYear()}-${caseId.slice(0,8).toUpperCase()}`;
      const [record]=await tx.insert(rmsCodeCases).values({id:caseId,tenantId,caseNumber,occupancyId:inspection.occupancyId,inspectionId:inspection.id,caseType:"VIOLATION",status:"OPEN",openedAt:now,complianceDueDate:finding.dueDate,summary:finding.title,createdByUserId:principal.userId,updatedByUserId:principal.userId,createdAt:now,updatedAt:now}).returning();
      if(!record)throw new ForgeError("INTERNAL_ERROR","Failed to create code enforcement case");
      const [violation]=await tx.insert(rmsCodeViolations).values({id:createId(),tenantId,caseId,inspectionFindingId:finding.id,title:finding.title,description:finding.description,severity:finding.severity,status:finding.status==="VERIFIED"?"VERIFIED":finding.status==="VOID"?"VOID":finding.status==="CORRECTED"?"CORRECTED":"OPEN",correctiveAction:finding.correctiveAction,correctionDueDate:finding.dueDate,correctedAt:finding.correctedAt,verifiedAt:finding.verifiedAt,verificationNotes:finding.verificationNotes,createdByUserId:principal.userId,updatedByUserId:principal.userId,createdAt:now,updatedAt:now}).returning();
      if(!violation)throw new ForgeError("INTERNAL_ERROR","Failed to create violation");
      await this.emit(tx,tenantId,"rms_code_case",caseId,"create_from_finding",principal,{case:record,violation});
      return {case:record,violation,existing:false};
    },principal.userId);
  }

  async patchCase(tenantId:string,id:string,input:unknown,principal:ForgePrincipal,expected:ExpectedVersion){
    const data=caseSchema.partial().parse(input);return withTenantTransaction(this.db,tenantId,async tx=>{
      const before=await tx.query.rmsCodeCases.findFirst({where:and(eq(rmsCodeCases.tenantId,tenantId),eq(rmsCodeCases.id,id),isNull(rmsCodeCases.deletedAt))});if(!before)throw new ForgeError("NOT_FOUND","Code enforcement case not found");
      if(expected!=="*"&&before.recordVersion!==expected)throw concurrencyConflict({tenantId,resourceType:"rms_code_case",resourceId:id,expectedVersion:expected,actualVersion:before.recordVersion});
      if(data.status==="CLOSED"){const violations=await tx.query.rmsCodeViolations.findMany({where:and(eq(rmsCodeViolations.tenantId,tenantId),eq(rmsCodeViolations.caseId,id))});if(violations.some(v=>v.status!=="VERIFIED"&&v.status!=="VOID"))throw new ForgeError("VALIDATION_ERROR","All violations must be VERIFIED or VOID before the case can close");}
      const now=new Date();const values:Record<string,unknown>={...data,recordVersion:before.recordVersion+1,updatedByUserId:principal.userId,updatedAt:now};if(data.status==="CLOSED"&&!before.closedAt)values.closedAt=now;if(data.status&&data.status!=="CLOSED")values.closedAt=null;
      const [row]=await tx.update(rmsCodeCases).set(values as never).where(and(eq(rmsCodeCases.id,id),eq(rmsCodeCases.recordVersion,before.recordVersion))).returning();if(!row)throw concurrencyConflict({tenantId,resourceType:"rms_code_case",resourceId:id,expectedVersion:expected,actualVersion:null});
      await this.emit(tx,tenantId,"rms_code_case",id,"update",principal,row,before);return row;
    },principal.userId);
  }

  async createViolation(tenantId:string,caseId:string,input:unknown,principal:ForgePrincipal){
    const data=violationSchema.parse(input);return withTenantTransaction(this.db,tenantId,async tx=>{
      const parent=await tx.query.rmsCodeCases.findFirst({where:and(eq(rmsCodeCases.tenantId,tenantId),eq(rmsCodeCases.id,caseId),isNull(rmsCodeCases.deletedAt))});if(!parent)throw new ForgeError("NOT_FOUND","Code enforcement case not found");
      const now=new Date();const [row]=await tx.insert(rmsCodeViolations).values({id:createId(),tenantId,caseId,...data,correctedAt:data.status==="CORRECTED"?now:null,verifiedAt:data.status==="VERIFIED"?now:null,createdByUserId:principal.userId,updatedByUserId:principal.userId,createdAt:now,updatedAt:now}).returning();if(!row)throw new ForgeError("INTERNAL_ERROR","Failed to create violation");
      await this.emit(tx,tenantId,"rms_code_violation",row.id,"create",principal,row);return row;
    },principal.userId);
  }

  async patchViolation(tenantId:string,id:string,input:unknown,principal:ForgePrincipal,expected:ExpectedVersion){
    const data=violationSchema.partial().parse(input);return withTenantTransaction(this.db,tenantId,async tx=>{
      const before=await tx.query.rmsCodeViolations.findFirst({where:and(eq(rmsCodeViolations.tenantId,tenantId),eq(rmsCodeViolations.id,id))});if(!before)throw new ForgeError("NOT_FOUND","Violation not found");
      if(expected!=="*"&&before.recordVersion!==expected)throw concurrencyConflict({tenantId,resourceType:"rms_code_violation",resourceId:id,expectedVersion:expected,actualVersion:before.recordVersion});
      const now=new Date();const values:Record<string,unknown>={...data,recordVersion:before.recordVersion+1,updatedByUserId:principal.userId,updatedAt:now};if(data.status==="CORRECTED"&&!before.correctedAt)values.correctedAt=now;if(data.status==="VERIFIED"&&!before.verifiedAt)values.verifiedAt=now;
      const [row]=await tx.update(rmsCodeViolations).set(values as never).where(and(eq(rmsCodeViolations.id,id),eq(rmsCodeViolations.recordVersion,before.recordVersion))).returning();if(!row)throw concurrencyConflict({tenantId,resourceType:"rms_code_violation",resourceId:id,expectedVersion:expected,actualVersion:null});
      if(before.inspectionFindingId&&data.status){const finding=await tx.query.rmsInspectionFindings.findFirst({where:and(eq(rmsInspectionFindings.tenantId,tenantId),eq(rmsInspectionFindings.id,before.inspectionFindingId))});if(finding&&["CORRECTED","VERIFIED","VOID"].includes(data.status)){await tx.update(rmsInspectionFindings).set({status:data.status,correctedAt:data.status==="CORRECTED"?(finding.correctedAt??now):finding.correctedAt,verifiedAt:data.status==="VERIFIED"?(finding.verifiedAt??now):finding.verifiedAt,recordVersion:finding.recordVersion+1,updatedByUserId:principal.userId,updatedAt:now}).where(eq(rmsInspectionFindings.id,finding.id));}}
      await this.emit(tx,tenantId,"rms_code_violation",id,"update",principal,row,before);return row;
    },principal.userId);
  }

  async issueNotice(tenantId:string,caseId:string,input:unknown,principal:ForgePrincipal){
    const data=noticeSchema.parse(input);return withTenantTransaction(this.db,tenantId,async tx=>{
      const parent=await tx.query.rmsCodeCases.findFirst({where:and(eq(rmsCodeCases.tenantId,tenantId),eq(rmsCodeCases.id,caseId),isNull(rmsCodeCases.deletedAt))});if(!parent)throw new ForgeError("NOT_FOUND","Code enforcement case not found");
      const now=new Date();const [notice]=await tx.insert(rmsCodeNotices).values({id:createId(),tenantId,caseId,...data,issuedAt:data.issuedAt?new Date(data.issuedAt):now,servedAt:data.servedAt?new Date(data.servedAt):null,createdByUserId:principal.userId,createdAt:now}).returning();if(!notice)throw new ForgeError("INTERNAL_ERROR","Failed to issue notice");
      let caseAfter=parent;if(parent.status==="OPEN"){const [updated]=await tx.update(rmsCodeCases).set({status:"NOTICE_ISSUED",recordVersion:parent.recordVersion+1,updatedByUserId:principal.userId,updatedAt:now}).where(and(eq(rmsCodeCases.id,caseId),eq(rmsCodeCases.recordVersion,parent.recordVersion))).returning();if(updated){caseAfter=updated;await this.emit(tx,tenantId,"rms_code_case",caseId,"notice_issued",principal,updated,parent);}}
      await this.emit(tx,tenantId,"rms_code_notice",notice.id,"issue",principal,notice);return {notice,case:caseAfter};
    },principal.userId);
  }

  private async emit(tx:Parameters<Parameters<typeof withTenantTransaction>[2]>[0],tenantId:string,resourceType:string,resourceId:string,action:string,principal:ForgePrincipal,after?:unknown,before?:unknown){
    await this.outbox.write(tx,{tenantId,aggregateType:resourceType,aggregateId:resourceId,eventType:DOMAIN_EVENT_TYPES.RMS_MASTERDATA_UPDATED,payload:{tenantId,resourceType,resourceId,action},correlationId:principal.correlationId,actorUserId:principal.userId});
    await this.audit.writeInTransaction(tx,{tenantId,actorUserId:principal.userId,actorPersonId:principal.personId,actorType:"USER",action:`rms.code_enforcement.${action}`,resourceType,resourceId,result:"SUCCESS",riskLevel:"MEDIUM",correlationId:principal.correlationId,requestId:principal.requestId,before,after});
  }
}
