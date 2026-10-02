import { Inject, Injectable } from "@nestjs/common";
import {
  createId,
  rmsInspectionFindings,
  rmsInspectionPrograms,
  rmsInspectionResponses,
  rmsInspections,
  rmsInspectionTemplates,
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

const programSchema=z.object({
  name:z.string().min(1).max(200),
  code:z.string().max(64).optional().nullable(),
  description:z.string().max(4000).optional().nullable(),
  active:z.boolean().default(true),
  frequency:z.string().max(80).optional().nullable(),
});

const templateSchema=z.object({
  programId:z.string().uuid().optional().nullable(),
  name:z.string().min(1).max(200),
  lifecycleStatus:z.enum(["DRAFT","PUBLISHED","RETIRED"]).default("DRAFT"),
  version:z.number().int().positive().default(1),
  sectionsJson:z.array(z.record(z.string(),z.unknown())).default([]),
});

const inspectionSchema=z.object({
  occupancyId:z.string().uuid(),
  programId:z.string().uuid().optional().nullable(),
  templateId:z.string().uuid().optional().nullable(),
  inspectorName:z.string().max(200).optional().nullable(),
  inspectionDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  scheduledDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  status:z.enum(["SCHEDULED","IN_PROGRESS","COMPLETED","CANCELLED"]).default("SCHEDULED"),
  overallResult:z.enum(["PENDING","PASS","CONDITIONAL","FAIL"]).default("PENDING"),
  followUpDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  notes:z.string().max(12000).optional().nullable(),
});

const responseSchema=z.object({
  sectionId:z.string().max(120).optional().nullable(),
  fieldKey:z.string().min(1).max(160),
  fieldLabel:z.string().max(300).optional().nullable(),
  result:z.enum(["PASS","FAIL","NA","INFO"]).optional().nullable(),
  valueJson:z.unknown().optional().nullable(),
  comment:z.string().max(4000).optional().nullable(),
});

const findingSchema=z.object({
  responseId:z.string().uuid().optional().nullable(),
  title:z.string().min(1).max(300),
  description:z.string().max(8000).optional().nullable(),
  severity:z.enum(["LOW","MODERATE","HIGH","CRITICAL"]).default("MODERATE"),
  correctiveAction:z.string().max(8000).optional().nullable(),
  responsibleParty:z.string().max(200).optional().nullable(),
  dueDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  status:z.enum(["OPEN","CORRECTED","VERIFIED","VOID"]).default("OPEN"),
  verificationNotes:z.string().max(8000).optional().nullable(),
});

function page(input:Record<string,string>){
  const p=Math.max(1,Number(input.page||1));const size=Math.min(200,Math.max(1,Number(input.pageSize||50)));
  return {page:p,pageSize:size,search:String(input.search||"").trim(),status:String(input.status||"").trim()};
}

@Injectable()
export class RmsInspectionsService{
  constructor(
    @Inject(DATABASE) private readonly db:Database,
    private readonly outbox:OutboxService,
    private readonly audit:AuditService,
  ){}

  async listPrograms(tenantId:string,query:Record<string,string>){
    const q=page(query);return withTenantTransaction(this.db,tenantId,async tx=>{
      const filters=[eq(rmsInspectionPrograms.tenantId,tenantId),isNull(rmsInspectionPrograms.deletedAt)];
      if(q.search)filters.push(or(ilike(rmsInspectionPrograms.name,`%${q.search}%`),ilike(rmsInspectionPrograms.code,`%${q.search}%`))!);
      const where=and(...filters);const items=await tx.select().from(rmsInspectionPrograms).where(where).limit(q.pageSize).offset((q.page-1)*q.pageSize);
      const totals=await tx.select({total:count()}).from(rmsInspectionPrograms).where(where);return {items,page:q.page,pageSize:q.pageSize,total:totals[0]?.total??0};
    });
  }

  async createProgram(tenantId:string,input:unknown,principal:ForgePrincipal){
    const data=programSchema.parse(input);return withTenantTransaction(this.db,tenantId,async tx=>{
      const now=new Date();const [row]=await tx.insert(rmsInspectionPrograms).values({id:createId(),tenantId,...data,createdByUserId:principal.userId,updatedByUserId:principal.userId,createdAt:now,updatedAt:now}).returning();
      if(!row)throw new ForgeError("INTERNAL_ERROR","Failed to create inspection program");
      await this.emit(tx,tenantId,"rms_inspection_program",row.id,"create",principal,row);return row;
    },principal.userId);
  }

  async patchProgram(tenantId:string,id:string,input:unknown,principal:ForgePrincipal,expected:ExpectedVersion){
    const data=programSchema.partial().parse(input);return withTenantTransaction(this.db,tenantId,async tx=>{
      const before=await tx.query.rmsInspectionPrograms.findFirst({where:and(eq(rmsInspectionPrograms.tenantId,tenantId),eq(rmsInspectionPrograms.id,id),isNull(rmsInspectionPrograms.deletedAt))});
      if(!before)throw new ForgeError("NOT_FOUND","Inspection program not found");
      if(expected!=="*"&&before.recordVersion!==expected)throw concurrencyConflict({tenantId,resourceType:"rms_inspection_program",resourceId:id,expectedVersion:expected,actualVersion:before.recordVersion});
      const [row]=await tx.update(rmsInspectionPrograms).set({...data,recordVersion:before.recordVersion+1,updatedByUserId:principal.userId,updatedAt:new Date()}).where(and(eq(rmsInspectionPrograms.id,id),eq(rmsInspectionPrograms.recordVersion,before.recordVersion))).returning();
      if(!row)throw concurrencyConflict({tenantId,resourceType:"rms_inspection_program",resourceId:id,expectedVersion:expected,actualVersion:null});
      await this.emit(tx,tenantId,"rms_inspection_program",id,"update",principal,row,before);return row;
    },principal.userId);
  }

  async listTemplates(tenantId:string,query:Record<string,string>){
    const q=page(query);return withTenantTransaction(this.db,tenantId,async tx=>{
      const filters=[eq(rmsInspectionTemplates.tenantId,tenantId),isNull(rmsInspectionTemplates.deletedAt)];
      if(q.search)filters.push(ilike(rmsInspectionTemplates.name,`%${q.search}%`));
      const where=and(...filters);const items=await tx.select().from(rmsInspectionTemplates).where(where).orderBy(desc(rmsInspectionTemplates.updatedAt)).limit(q.pageSize).offset((q.page-1)*q.pageSize);
      const totals=await tx.select({total:count()}).from(rmsInspectionTemplates).where(where);return {items,page:q.page,pageSize:q.pageSize,total:totals[0]?.total??0};
    });
  }

  async createTemplate(tenantId:string,input:unknown,principal:ForgePrincipal){
    const data=templateSchema.parse(input);return withTenantTransaction(this.db,tenantId,async tx=>{
      if(data.programId){const p=await tx.query.rmsInspectionPrograms.findFirst({where:and(eq(rmsInspectionPrograms.tenantId,tenantId),eq(rmsInspectionPrograms.id,data.programId),isNull(rmsInspectionPrograms.deletedAt))});if(!p)throw new ForgeError("NOT_FOUND","Inspection program not found");}
      const now=new Date();const [row]=await tx.insert(rmsInspectionTemplates).values({id:createId(),tenantId,...data,publishedAt:data.lifecycleStatus==="PUBLISHED"?now:null,createdByUserId:principal.userId,updatedByUserId:principal.userId,createdAt:now,updatedAt:now}).returning();
      if(!row)throw new ForgeError("INTERNAL_ERROR","Failed to create inspection template");
      await this.emit(tx,tenantId,"rms_inspection_template",row.id,"create",principal,row);return row;
    },principal.userId);
  }

  async patchTemplate(tenantId:string,id:string,input:unknown,principal:ForgePrincipal,expected:ExpectedVersion){
    const data=templateSchema.partial().parse(input);return withTenantTransaction(this.db,tenantId,async tx=>{
      const before=await tx.query.rmsInspectionTemplates.findFirst({where:and(eq(rmsInspectionTemplates.tenantId,tenantId),eq(rmsInspectionTemplates.id,id),isNull(rmsInspectionTemplates.deletedAt))});
      if(!before)throw new ForgeError("NOT_FOUND","Inspection template not found");
      if(data.programId){const program=await tx.query.rmsInspectionPrograms.findFirst({where:and(eq(rmsInspectionPrograms.tenantId,tenantId),eq(rmsInspectionPrograms.id,data.programId),isNull(rmsInspectionPrograms.deletedAt))});if(!program)throw new ForgeError("NOT_FOUND","Inspection program not found");}
      if(expected!=="*"&&before.recordVersion!==expected)throw concurrencyConflict({tenantId,resourceType:"rms_inspection_template",resourceId:id,expectedVersion:expected,actualVersion:before.recordVersion});
      const now=new Date();const values:Record<string,unknown>={...data,recordVersion:before.recordVersion+1,updatedByUserId:principal.userId,updatedAt:now};
      if(data.lifecycleStatus==="PUBLISHED"&&!before.publishedAt)values.publishedAt=now;
      const [row]=await tx.update(rmsInspectionTemplates).set(values as never).where(and(eq(rmsInspectionTemplates.id,id),eq(rmsInspectionTemplates.recordVersion,before.recordVersion))).returning();
      if(!row)throw concurrencyConflict({tenantId,resourceType:"rms_inspection_template",resourceId:id,expectedVersion:expected,actualVersion:null});
      await this.emit(tx,tenantId,"rms_inspection_template",id,"update",principal,row,before);return row;
    },principal.userId);
  }

  async listInspections(tenantId:string,query:Record<string,string>){
    const q=page(query);return withTenantTransaction(this.db,tenantId,async tx=>{
      const filters=[eq(rmsInspections.tenantId,tenantId),isNull(rmsInspections.deletedAt)];
      if(q.status)filters.push(eq(rmsInspections.status,q.status));
      const where=and(...filters);const items=await tx.select().from(rmsInspections).where(where).orderBy(desc(rmsInspections.inspectionDate)).limit(q.pageSize).offset((q.page-1)*q.pageSize);
      const totals=await tx.select({total:count()}).from(rmsInspections).where(where);return {items,page:q.page,pageSize:q.pageSize,total:totals[0]?.total??0};
    });
  }

  async getInspection(tenantId:string,id:string){
    return withTenantTransaction(this.db,tenantId,async tx=>{
      const inspection=await tx.query.rmsInspections.findFirst({where:and(eq(rmsInspections.tenantId,tenantId),eq(rmsInspections.id,id),isNull(rmsInspections.deletedAt))});
      if(!inspection)throw new ForgeError("NOT_FOUND","Inspection not found");
      const [responses,findings]=await Promise.all([
        tx.query.rmsInspectionResponses.findMany({where:and(eq(rmsInspectionResponses.tenantId,tenantId),eq(rmsInspectionResponses.inspectionId,id))}),
        tx.query.rmsInspectionFindings.findMany({where:and(eq(rmsInspectionFindings.tenantId,tenantId),eq(rmsInspectionFindings.inspectionId,id)),orderBy:[desc(rmsInspectionFindings.createdAt)]}),
      ]);
      return {inspection,responses,findings};
    });
  }

  async createInspection(tenantId:string,input:unknown,principal:ForgePrincipal){
    const data=inspectionSchema.parse(input);return withTenantTransaction(this.db,tenantId,async tx=>{
      const occupancy=await tx.query.rmsOccupancies.findFirst({where:and(eq(rmsOccupancies.tenantId,tenantId),eq(rmsOccupancies.id,data.occupancyId),isNull(rmsOccupancies.deletedAt))});
      if(!occupancy)throw new ForgeError("NOT_FOUND","Occupancy not found");
      let snapshot:Array<Record<string,unknown>>=[];if(data.templateId){const t=await tx.query.rmsInspectionTemplates.findFirst({where:and(eq(rmsInspectionTemplates.tenantId,tenantId),eq(rmsInspectionTemplates.id,data.templateId),isNull(rmsInspectionTemplates.deletedAt))});if(!t)throw new ForgeError("NOT_FOUND","Inspection template not found");snapshot=t.sectionsJson??[];}
      const now=new Date();const [row]=await tx.insert(rmsInspections).values({id:createId(),tenantId,...data,checklistSnapshotJson:snapshot,startedAt:data.status==="IN_PROGRESS"?now:null,completedAt:data.status==="COMPLETED"?now:null,createdByUserId:principal.userId,updatedByUserId:principal.userId,createdAt:now,updatedAt:now}).returning();
      if(!row)throw new ForgeError("INTERNAL_ERROR","Failed to create inspection");
      await this.emit(tx,tenantId,"rms_inspection",row.id,"create",principal,row);return row;
    },principal.userId);
  }

  async patchInspection(tenantId:string,id:string,input:unknown,principal:ForgePrincipal,expected:ExpectedVersion){
    const data=inspectionSchema.partial().parse(input);return withTenantTransaction(this.db,tenantId,async tx=>{
      const before=await tx.query.rmsInspections.findFirst({where:and(eq(rmsInspections.tenantId,tenantId),eq(rmsInspections.id,id),isNull(rmsInspections.deletedAt))});
      if(!before)throw new ForgeError("NOT_FOUND","Inspection not found");if(expected!=="*"&&before.recordVersion!==expected)throw concurrencyConflict({tenantId,resourceType:"rms_inspection",resourceId:id,expectedVersion:expected,actualVersion:before.recordVersion});
      const now=new Date();const values:Record<string,unknown>={...data,recordVersion:before.recordVersion+1,updatedByUserId:principal.userId,updatedAt:now};
      if(data.status==="IN_PROGRESS"&&!before.startedAt)values.startedAt=now;if(data.status==="COMPLETED"&&!before.completedAt)values.completedAt=now;
      const [row]=await tx.update(rmsInspections).set(values as never).where(and(eq(rmsInspections.id,id),eq(rmsInspections.recordVersion,before.recordVersion))).returning();
      if(!row)throw concurrencyConflict({tenantId,resourceType:"rms_inspection",resourceId:id,expectedVersion:expected,actualVersion:null});
      await this.emit(tx,tenantId,"rms_inspection",id,"update",principal,row,before);return row;
    },principal.userId);
  }

  async upsertResponse(tenantId:string,inspectionId:string,input:unknown,principal:ForgePrincipal){
    const data=responseSchema.parse(input);return withTenantTransaction(this.db,tenantId,async tx=>{
      const inspection=await tx.query.rmsInspections.findFirst({where:and(eq(rmsInspections.tenantId,tenantId),eq(rmsInspections.id,inspectionId),isNull(rmsInspections.deletedAt))});if(!inspection)throw new ForgeError("NOT_FOUND","Inspection not found");
      const existing=await tx.query.rmsInspectionResponses.findFirst({where:and(eq(rmsInspectionResponses.tenantId,tenantId),eq(rmsInspectionResponses.inspectionId,inspectionId),eq(rmsInspectionResponses.fieldKey,data.fieldKey))});
      const now=new Date();
      if(existing){
        const [row]=await tx.update(rmsInspectionResponses).set({...data,recordVersion:existing.recordVersion+1,updatedByUserId:principal.userId,updatedAt:now}).where(eq(rmsInspectionResponses.id,existing.id)).returning();
        if(!row)throw new ForgeError("INTERNAL_ERROR","Failed to update inspection response");
        await this.emit(tx,tenantId,"rms_inspection_response",row.id,"update",principal,row,existing);
        return row;
      }
      const [row]=await tx.insert(rmsInspectionResponses).values({id:createId(),tenantId,inspectionId,...data,createdByUserId:principal.userId,updatedByUserId:principal.userId,createdAt:now,updatedAt:now}).returning();
      if(!row)throw new ForgeError("INTERNAL_ERROR","Failed to create inspection response");
      await this.emit(tx,tenantId,"rms_inspection_response",row.id,"create",principal,row);
      return row;
    },principal.userId);
  }

  async createFinding(tenantId:string,inspectionId:string,input:unknown,principal:ForgePrincipal){
    const data=findingSchema.parse(input);return withTenantTransaction(this.db,tenantId,async tx=>{
      const inspection=await tx.query.rmsInspections.findFirst({where:and(eq(rmsInspections.tenantId,tenantId),eq(rmsInspections.id,inspectionId),isNull(rmsInspections.deletedAt))});if(!inspection)throw new ForgeError("NOT_FOUND","Inspection not found");
      const now=new Date();const [row]=await tx.insert(rmsInspectionFindings).values({id:createId(),tenantId,inspectionId,...data,correctedAt:data.status==="CORRECTED"?now:null,verifiedAt:data.status==="VERIFIED"?now:null,createdByUserId:principal.userId,updatedByUserId:principal.userId,createdAt:now,updatedAt:now}).returning();
      if(!row)throw new ForgeError("INTERNAL_ERROR","Failed to create inspection finding");await this.emit(tx,tenantId,"rms_inspection_finding",row.id,"create",principal,row);return row;
    },principal.userId);
  }

  async patchFinding(tenantId:string,id:string,input:unknown,principal:ForgePrincipal,expected:ExpectedVersion){
    const data=findingSchema.partial().parse(input);return withTenantTransaction(this.db,tenantId,async tx=>{
      const before=await tx.query.rmsInspectionFindings.findFirst({where:and(eq(rmsInspectionFindings.tenantId,tenantId),eq(rmsInspectionFindings.id,id))});if(!before)throw new ForgeError("NOT_FOUND","Inspection finding not found");
      if(expected!=="*"&&before.recordVersion!==expected)throw concurrencyConflict({tenantId,resourceType:"rms_inspection_finding",resourceId:id,expectedVersion:expected,actualVersion:before.recordVersion});
      const now=new Date();const values:Record<string,unknown>={...data,recordVersion:before.recordVersion+1,updatedByUserId:principal.userId,updatedAt:now};if(data.status==="CORRECTED"&&!before.correctedAt)values.correctedAt=now;if(data.status==="VERIFIED"&&!before.verifiedAt)values.verifiedAt=now;
      const [row]=await tx.update(rmsInspectionFindings).set(values as never).where(and(eq(rmsInspectionFindings.id,id),eq(rmsInspectionFindings.recordVersion,before.recordVersion))).returning();if(!row)throw concurrencyConflict({tenantId,resourceType:"rms_inspection_finding",resourceId:id,expectedVersion:expected,actualVersion:null});
      await this.emit(tx,tenantId,"rms_inspection_finding",id,"update",principal,row,before);return row;
    },principal.userId);
  }

  private async emit(tx:Parameters<Parameters<typeof withTenantTransaction>[2]>[0],tenantId:string,resourceType:string,resourceId:string,action:string,principal:ForgePrincipal,after?:unknown,before?:unknown){
    await this.outbox.write(tx,{tenantId,aggregateType:resourceType,aggregateId:resourceId,eventType:DOMAIN_EVENT_TYPES.RMS_MASTERDATA_UPDATED,payload:{tenantId,resourceType,resourceId,action},correlationId:principal.correlationId,actorUserId:principal.userId});
    await this.audit.writeInTransaction(tx,{tenantId,actorUserId:principal.userId,actorPersonId:principal.personId,actorType:"USER",action:`rms.prevention.${action}`,resourceType,resourceId,result:"SUCCESS",riskLevel:"LOW",correlationId:principal.correlationId,requestId:principal.requestId,before,after});
  }
}
