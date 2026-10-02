import { Inject, Injectable } from "@nestjs/common";
import {
  createId,
  nerisIncidents,
  rmsInvestigationCases,
  rmsInvestigationCustodyEvents,
  rmsInvestigationEvidence,
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
  incidentId:z.string().uuid().optional().nullable(),
  occupancyId:z.string().uuid().optional().nullable(),
  caseType:z.enum(["FIRE_INVESTIGATION","ORIGIN_CAUSE","CODE_REFERRAL","ADMIN_REVIEW"]).default("FIRE_INVESTIGATION"),
  leadInvestigator:z.string().max(200).optional().nullable(),
  status:z.enum(["OPEN","SCENE_SECURED","ANALYSIS","PENDING_REVIEW","CLOSED","VOID"]).default("OPEN"),
  location:z.string().max(2000).optional().nullable(),
  sceneStatus:z.enum(["SECURED","RELEASED","RESTRICTED"]).optional().nullable(),
  weather:z.string().max(200).optional().nullable(),
  initialObservations:z.string().max(20000).optional().nullable(),
  areaOfOrigin:z.string().max(12000).optional().nullable(),
  causeClassification:z.enum(["UNDETERMINED","ACCIDENTAL","INCENDIARY","NATURAL","OTHER"]).optional().nullable(),
  causeNarrative:z.string().max(30000).optional().nullable(),
  disposition:z.string().max(120).optional().nullable(),
  supervisorReviewStatus:z.enum(["NOT_SUBMITTED","PENDING","APPROVED","RETURNED"]).default("NOT_SUBMITTED"),
  supervisorReviewer:z.string().max(200).optional().nullable(),
  supervisorNotes:z.string().max(12000).optional().nullable(),
});

const evidenceSchema=z.object({
  evidenceType:z.enum(["PHOTO","PHYSICAL","DOCUMENT","INTERVIEW","VIDEO","OTHER"]),
  tagNumber:z.string().min(1).max(80),
  title:z.string().max(300).optional().nullable(),
  description:z.string().max(12000).optional().nullable(),
  collectedAt:z.string().datetime({offset:true}).optional().nullable(),
  collectedBy:z.string().max(200).optional().nullable(),
  currentCustodian:z.string().max(200).optional().nullable(),
  storageLocation:z.string().max(300).optional().nullable(),
  status:z.enum(["IN_CUSTODY","RELEASED","RETURNED","DISPOSED"]).default("IN_CUSTODY"),
  notes:z.string().max(12000).optional().nullable(),
});

const custodySchema=z.object({
  action:z.enum(["COLLECTED","TRANSFERRED","STORED","RELEASED","RETURNED","DISPOSED"]),
  occurredAt:z.string().datetime({offset:true}).optional(),
  fromCustodian:z.string().max(200).optional().nullable(),
  toCustodian:z.string().max(200).optional().nullable(),
  location:z.string().max(300).optional().nullable(),
  notes:z.string().max(12000).optional().nullable(),
});

function pageQuery(input:Record<string,string>){
  return {page:Math.max(1,Number(input.page||1)),pageSize:Math.min(200,Math.max(1,Number(input.pageSize||50))),search:String(input.search||"").trim(),status:String(input.status||"").trim()};
}

@Injectable()
export class RmsInvestigationsService{
  constructor(@Inject(DATABASE) private readonly db:Database,private readonly outbox:OutboxService,private readonly audit:AuditService){}

  async listCases(tenantId:string,query:Record<string,string>){
    const q=pageQuery(query);return withTenantTransaction(this.db,tenantId,async tx=>{
      const filters=[eq(rmsInvestigationCases.tenantId,tenantId),isNull(rmsInvestigationCases.deletedAt)];
      if(q.status)filters.push(eq(rmsInvestigationCases.status,q.status));
      if(q.search)filters.push(or(ilike(rmsInvestigationCases.caseNumber,`%${q.search}%`),ilike(rmsInvestigationCases.leadInvestigator,`%${q.search}%`),ilike(rmsInvestigationCases.location,`%${q.search}%`))!);
      const where=and(...filters);const items=await tx.select().from(rmsInvestigationCases).where(where).orderBy(desc(rmsInvestigationCases.openedAt)).limit(q.pageSize).offset((q.page-1)*q.pageSize);
      const totals=await tx.select({total:count()}).from(rmsInvestigationCases).where(where);return {items,page:q.page,pageSize:q.pageSize,total:totals[0]?.total??0};
    });
  }

  async getCase(tenantId:string,id:string){
    return withTenantTransaction(this.db,tenantId,async tx=>{
      const record=await tx.query.rmsInvestigationCases.findFirst({where:and(eq(rmsInvestigationCases.tenantId,tenantId),eq(rmsInvestigationCases.id,id),isNull(rmsInvestigationCases.deletedAt))});
      if(!record)throw new ForgeError("NOT_FOUND","Investigation case not found");
      const evidence=await tx.query.rmsInvestigationEvidence.findMany({where:and(eq(rmsInvestigationEvidence.tenantId,tenantId),eq(rmsInvestigationEvidence.caseId,id)),orderBy:[desc(rmsInvestigationEvidence.createdAt)]});
      const ids=evidence.map(e=>e.id);
      const custody=ids.length?await tx.query.rmsInvestigationCustodyEvents.findMany({where:eq(rmsInvestigationCustodyEvents.tenantId,tenantId),orderBy:[desc(rmsInvestigationCustodyEvents.occurredAt)]}):[];
      return {case:record,evidence,custodyEvents:custody.filter(event=>ids.includes(event.evidenceId))};
    });
  }

  async createCase(tenantId:string,input:unknown,principal:ForgePrincipal){
    const data=caseSchema.parse(input);return withTenantTransaction(this.db,tenantId,async tx=>{
      if(data.incidentId){const incident=await tx.query.nerisIncidents.findFirst({where:and(eq(nerisIncidents.tenantId,tenantId),eq(nerisIncidents.id,data.incidentId),isNull(nerisIncidents.deletedAt))});if(!incident)throw new ForgeError("NOT_FOUND","Incident not found");}
      if(data.occupancyId){const occupancy=await tx.query.rmsOccupancies.findFirst({where:and(eq(rmsOccupancies.tenantId,tenantId),eq(rmsOccupancies.id,data.occupancyId),isNull(rmsOccupancies.deletedAt))});if(!occupancy)throw new ForgeError("NOT_FOUND","Occupancy not found");}
      const id=createId();const now=new Date();const caseNumber=`INV-${now.getUTCFullYear()}-${id.slice(0,8).toUpperCase()}`;
      const [row]=await tx.insert(rmsInvestigationCases).values({id,tenantId,caseNumber,...data,openedAt:now,closedAt:data.status==="CLOSED"?now:null,supervisorReviewedAt:data.supervisorReviewStatus==="APPROVED"?now:null,createdByUserId:principal.userId,updatedByUserId:principal.userId,createdAt:now,updatedAt:now}).returning();
      if(!row)throw new ForgeError("INTERNAL_ERROR","Failed to create investigation case");await this.emit(tx,tenantId,"rms_investigation_case",id,"create",principal,row);return row;
    },principal.userId);
  }

  async patchCase(tenantId:string,id:string,input:unknown,principal:ForgePrincipal,expected:ExpectedVersion){
    const data=caseSchema.partial().parse(input);return withTenantTransaction(this.db,tenantId,async tx=>{
      const before=await tx.query.rmsInvestigationCases.findFirst({where:and(eq(rmsInvestigationCases.tenantId,tenantId),eq(rmsInvestigationCases.id,id),isNull(rmsInvestigationCases.deletedAt))});if(!before)throw new ForgeError("NOT_FOUND","Investigation case not found");
      if(expected!=="*"&&before.recordVersion!==expected)throw concurrencyConflict({tenantId,resourceType:"rms_investigation_case",resourceId:id,expectedVersion:expected,actualVersion:before.recordVersion});
      const nextReview=data.supervisorReviewStatus??before.supervisorReviewStatus;if(data.status==="CLOSED"&&nextReview!=="APPROVED")throw new ForgeError("VALIDATION_ERROR","Supervisor approval is required before closing an investigation");
      const now=new Date();const values:Record<string,unknown>={...data,recordVersion:before.recordVersion+1,updatedByUserId:principal.userId,updatedAt:now};
      if(data.supervisorReviewStatus==="PENDING")values.status="PENDING_REVIEW";
      if(data.supervisorReviewStatus==="APPROVED"){values.supervisorReviewedAt=now;if(before.status==="PENDING_REVIEW"&&data.status===undefined)values.status="ANALYSIS";}
      if(data.supervisorReviewStatus==="RETURNED"){values.supervisorReviewedAt=now;values.status="ANALYSIS";}
      if(data.status==="CLOSED"&&!before.closedAt)values.closedAt=now;if(data.status&&data.status!=="CLOSED")values.closedAt=null;
      const [row]=await tx.update(rmsInvestigationCases).set(values as never).where(and(eq(rmsInvestigationCases.id,id),eq(rmsInvestigationCases.recordVersion,before.recordVersion))).returning();
      if(!row)throw concurrencyConflict({tenantId,resourceType:"rms_investigation_case",resourceId:id,expectedVersion:expected,actualVersion:null});
      await this.emit(tx,tenantId,"rms_investigation_case",id,"update",principal,row,before);return row;
    },principal.userId);
  }

  async createEvidence(tenantId:string,caseId:string,input:unknown,principal:ForgePrincipal){
    const data=evidenceSchema.parse(input);return withTenantTransaction(this.db,tenantId,async tx=>{
      const parent=await tx.query.rmsInvestigationCases.findFirst({where:and(eq(rmsInvestigationCases.tenantId,tenantId),eq(rmsInvestigationCases.id,caseId),isNull(rmsInvestigationCases.deletedAt))});if(!parent)throw new ForgeError("NOT_FOUND","Investigation case not found");
      const now=new Date();const id=createId();const [row]=await tx.insert(rmsInvestigationEvidence).values({id,tenantId,caseId,...data,collectedAt:data.collectedAt?new Date(data.collectedAt):null,createdByUserId:principal.userId,updatedByUserId:principal.userId,createdAt:now,updatedAt:now}).returning();if(!row)throw new ForgeError("INTERNAL_ERROR","Failed to create evidence");
      if(data.collectedAt||data.collectedBy||data.currentCustodian){await tx.insert(rmsInvestigationCustodyEvents).values({id:createId(),tenantId,evidenceId:id,action:"COLLECTED",occurredAt:data.collectedAt?new Date(data.collectedAt):now,fromCustodian:null,toCustodian:data.currentCustodian??data.collectedBy??null,location:data.storageLocation,notes:"Initial evidence intake",createdByUserId:principal.userId,createdAt:now});}
      await this.emit(tx,tenantId,"rms_investigation_evidence",id,"create",principal,row);return row;
    },principal.userId);
  }

  async patchEvidence(tenantId:string,id:string,input:unknown,principal:ForgePrincipal,expected:ExpectedVersion){
    const data=evidenceSchema.partial().parse(input);return withTenantTransaction(this.db,tenantId,async tx=>{
      const before=await tx.query.rmsInvestigationEvidence.findFirst({where:and(eq(rmsInvestigationEvidence.tenantId,tenantId),eq(rmsInvestigationEvidence.id,id))});if(!before)throw new ForgeError("NOT_FOUND","Evidence not found");
      if(expected!=="*"&&before.recordVersion!==expected)throw concurrencyConflict({tenantId,resourceType:"rms_investigation_evidence",resourceId:id,expectedVersion:expected,actualVersion:before.recordVersion});
      const [row]=await tx.update(rmsInvestigationEvidence).set({...data,collectedAt:data.collectedAt?new Date(data.collectedAt):data.collectedAt,recordVersion:before.recordVersion+1,updatedByUserId:principal.userId,updatedAt:new Date()}).where(and(eq(rmsInvestigationEvidence.id,id),eq(rmsInvestigationEvidence.recordVersion,before.recordVersion))).returning();if(!row)throw concurrencyConflict({tenantId,resourceType:"rms_investigation_evidence",resourceId:id,expectedVersion:expected,actualVersion:null});
      await this.emit(tx,tenantId,"rms_investigation_evidence",id,"update",principal,row,before);return row;
    },principal.userId);
  }

  async addCustodyEvent(tenantId:string,evidenceId:string,input:unknown,principal:ForgePrincipal){
    const data=custodySchema.parse(input);return withTenantTransaction(this.db,tenantId,async tx=>{
      const evidence=await tx.query.rmsInvestigationEvidence.findFirst({where:and(eq(rmsInvestigationEvidence.tenantId,tenantId),eq(rmsInvestigationEvidence.id,evidenceId))});if(!evidence)throw new ForgeError("NOT_FOUND","Evidence not found");
      const now=new Date();const occurredAt=data.occurredAt?new Date(data.occurredAt):now;
      const [event]=await tx.insert(rmsInvestigationCustodyEvents).values({id:createId(),tenantId,evidenceId,...data,occurredAt,createdByUserId:principal.userId,createdAt:now}).returning();if(!event)throw new ForgeError("INTERNAL_ERROR","Failed to create custody event");
      const values:Record<string,unknown>={recordVersion:evidence.recordVersion+1,updatedByUserId:principal.userId,updatedAt:now};
      if(data.toCustodian)values.currentCustodian=data.toCustodian;if(data.location)values.storageLocation=data.location;
      if(data.action==="RELEASED")values.status="RELEASED";else if(data.action==="RETURNED")values.status="RETURNED";else if(data.action==="DISPOSED")values.status="DISPOSED";else values.status="IN_CUSTODY";
      const [updated]=await tx.update(rmsInvestigationEvidence).set(values as never).where(and(eq(rmsInvestigationEvidence.id,evidenceId),eq(rmsInvestigationEvidence.recordVersion,evidence.recordVersion))).returning();if(!updated)throw concurrencyConflict({tenantId,resourceType:"rms_investigation_evidence",resourceId:evidenceId,expectedVersion:evidence.recordVersion,actualVersion:null});
      await this.emit(tx,tenantId,"rms_investigation_custody_event",event.id,"create",principal,event);await this.emit(tx,tenantId,"rms_investigation_evidence",evidenceId,"custody_update",principal,updated,evidence);return {event,evidence:updated};
    },principal.userId);
  }

  private async emit(tx:Parameters<Parameters<typeof withTenantTransaction>[2]>[0],tenantId:string,resourceType:string,resourceId:string,action:string,principal:ForgePrincipal,after?:unknown,before?:unknown){
    await this.outbox.write(tx,{tenantId,aggregateType:resourceType,aggregateId:resourceId,eventType:DOMAIN_EVENT_TYPES.RMS_MASTERDATA_UPDATED,payload:{tenantId,resourceType,resourceId,action},correlationId:principal.correlationId,actorUserId:principal.userId});
    await this.audit.writeInTransaction(tx,{tenantId,actorUserId:principal.userId,actorPersonId:principal.personId,actorType:"USER",action:`rms.investigations.${action}`,resourceType,resourceId,result:"SUCCESS",riskLevel:"MEDIUM",correlationId:principal.correlationId,requestId:principal.requestId,before,after});
  }
}
