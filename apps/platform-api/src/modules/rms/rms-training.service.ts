import {Inject,Injectable} from "@nestjs/common";
import {
  createId,
  rmsCertificationTypes,
  rmsPersonnel,
  rmsPersonnelCertifications,
  rmsTrainingCourses,
  rmsTrainingRecords,
  type Database,
  withTenantTransaction,
} from "@forge/database";
import {ForgeError} from "@forge/errors";
import {DOMAIN_EVENT_TYPES} from "@forge/events";
import type {ForgePrincipal} from "@forge/tenant-context";
import {and,count,desc,eq,ilike,isNull,or} from "drizzle-orm";
import {z} from "zod";
import {concurrencyConflict} from "../../common/concurrency.js";
import {DATABASE} from "../../tokens.js";
import {AuditService} from "../audit/audit.service.js";
import {OutboxService} from "../outbox/outbox.service.js";

type ExpectedVersion=number|"*";

const courseSchema=z.object({
  code:z.string().min(1).max(64),
  title:z.string().min(1).max(240),
  category:z.string().max(80).default("GENERAL"),
  description:z.string().max(20000).optional().nullable(),
  deliveryMode:z.enum(["IN_PERSON","ONLINE","HYBRID","SKILL","LIVE_FIRE","OTHER"]).default("IN_PERSON"),
  defaultHours:z.number().nonnegative().optional().nullable(),
  recurrenceMonths:z.number().int().positive().max(240).optional().nullable(),
  requiredForIncidentEligibility:z.boolean().default(false),
  status:z.enum(["ACTIVE","INACTIVE","ARCHIVED"]).default("ACTIVE"),
});

const trainingRecordSchema=z.object({
  courseId:z.string().uuid(),
  personnelId:z.string().uuid(),
  completedAt:z.string().datetime({offset:true}),
  expiresAt:z.string().datetime({offset:true}).optional().nullable(),
  hours:z.number().nonnegative().optional().nullable(),
  status:z.enum(["COMPLETED","FAILED","INCOMPLETE","WAIVED"]).default("COMPLETED"),
  instructor:z.string().max(200).optional().nullable(),
  location:z.string().max(300).optional().nullable(),
  score:z.number().min(0).max(100).optional().nullable(),
  certificateNumber:z.string().max(160).optional().nullable(),
  notes:z.string().max(12000).optional().nullable(),
  source:z.enum(["MANUAL","IMPORT","ACADEMY","LMS","SYSTEM"]).default("MANUAL"),
});

const certificationTypeSchema=z.object({
  code:z.string().min(1).max(64),
  name:z.string().min(1).max(240),
  issuingAuthority:z.string().max(240).optional().nullable(),
  category:z.string().max(80).default("GENERAL"),
  defaultValidityMonths:z.number().int().positive().max(240).optional().nullable(),
  requiredForIncidentEligibility:z.boolean().default(false),
  status:z.enum(["ACTIVE","INACTIVE","ARCHIVED"]).default("ACTIVE"),
});

const personnelCertificationSchema=z.object({
  personnelId:z.string().uuid(),
  certificationTypeId:z.string().uuid(),
  credentialNumber:z.string().max(160).optional().nullable(),
  issuedAt:z.string().date().optional().nullable(),
  expiresAt:z.string().date().optional().nullable(),
  status:z.enum(["ACTIVE","EXPIRED","SUSPENDED","REVOKED","PENDING"]).default("ACTIVE"),
  verifiedAt:z.string().datetime({offset:true}).optional().nullable(),
  verifiedBy:z.string().max(200).optional().nullable(),
  notes:z.string().max(12000).optional().nullable(),
});

function pageQuery(q:Record<string,string>){return {page:Math.max(1,Number(q.page||1)),pageSize:Math.min(200,Math.max(1,Number(q.pageSize||50))),search:String(q.search||"").trim(),status:String(q.status||"").trim(),personnelId:String(q.personnelId||"").trim(),courseId:String(q.courseId||"").trim(),certificationTypeId:String(q.certificationTypeId||"").trim()};}

@Injectable()
export class RmsTrainingService{
  constructor(@Inject(DATABASE) private readonly db:Database,private readonly outbox:OutboxService,private readonly audit:AuditService){}

  async listCourses(tenantId:string,query:Record<string,string>){
    const q=pageQuery(query);return withTenantTransaction(this.db,tenantId,async tx=>{
      const filters=[eq(rmsTrainingCourses.tenantId,tenantId),isNull(rmsTrainingCourses.deletedAt)];
      if(q.status)filters.push(eq(rmsTrainingCourses.status,q.status));
      if(q.search)filters.push(or(ilike(rmsTrainingCourses.code,`%${q.search}%`),ilike(rmsTrainingCourses.title,`%${q.search}%`),ilike(rmsTrainingCourses.category,`%${q.search}%`))!);
      const where=and(...filters);const items=await tx.select().from(rmsTrainingCourses).where(where).orderBy(rmsTrainingCourses.code).limit(q.pageSize).offset((q.page-1)*q.pageSize);const totals=await tx.select({total:count()}).from(rmsTrainingCourses).where(where);return {items,page:q.page,pageSize:q.pageSize,total:totals[0]?.total??0};
    });
  }

  async createCourse(tenantId:string,input:unknown,principal:ForgePrincipal){
    const data=courseSchema.parse(input);return withTenantTransaction(this.db,tenantId,async tx=>{const now=new Date();const [row]=await tx.insert(rmsTrainingCourses).values({id:createId(),tenantId,...data,createdByUserId:principal.userId,updatedByUserId:principal.userId,createdAt:now,updatedAt:now}).returning();if(!row)throw new ForgeError("INTERNAL_ERROR","Failed to create course");await this.emit(tx,tenantId,"rms_training_course",row.id,"create",principal,row);return row;},principal.userId);
  }

  async patchCourse(tenantId:string,id:string,input:unknown,principal:ForgePrincipal,expected:ExpectedVersion){
    const data=courseSchema.partial().parse(input);return withTenantTransaction(this.db,tenantId,async tx=>{const before=await tx.query.rmsTrainingCourses.findFirst({where:and(eq(rmsTrainingCourses.tenantId,tenantId),eq(rmsTrainingCourses.id,id),isNull(rmsTrainingCourses.deletedAt))});if(!before)throw new ForgeError("NOT_FOUND","Training course not found");if(expected!=="*"&&before.recordVersion!==expected)throw concurrencyConflict({tenantId,resourceType:"rms_training_course",resourceId:id,expectedVersion:expected,actualVersion:before.recordVersion});const [row]=await tx.update(rmsTrainingCourses).set({...data,recordVersion:before.recordVersion+1,updatedByUserId:principal.userId,updatedAt:new Date()}).where(and(eq(rmsTrainingCourses.id,id),eq(rmsTrainingCourses.recordVersion,before.recordVersion))).returning();if(!row)throw concurrencyConflict({tenantId,resourceType:"rms_training_course",resourceId:id,expectedVersion:expected,actualVersion:null});await this.emit(tx,tenantId,"rms_training_course",id,"update",principal,row,before);return row;},principal.userId);
  }

  async listTrainingRecords(tenantId:string,query:Record<string,string>){
    const q=pageQuery(query);return withTenantTransaction(this.db,tenantId,async tx=>{const filters=[eq(rmsTrainingRecords.tenantId,tenantId)];if(q.personnelId)filters.push(eq(rmsTrainingRecords.personnelId,q.personnelId));if(q.courseId)filters.push(eq(rmsTrainingRecords.courseId,q.courseId));if(q.status)filters.push(eq(rmsTrainingRecords.status,q.status));const where=and(...filters);const items=await tx.select().from(rmsTrainingRecords).where(where).orderBy(desc(rmsTrainingRecords.completedAt)).limit(q.pageSize).offset((q.page-1)*q.pageSize);const totals=await tx.select({total:count()}).from(rmsTrainingRecords).where(where);return {items,page:q.page,pageSize:q.pageSize,total:totals[0]?.total??0};});
  }

  async createTrainingRecord(tenantId:string,input:unknown,principal:ForgePrincipal){
    const data=trainingRecordSchema.parse(input);return withTenantTransaction(this.db,tenantId,async tx=>{await this.requirePersonnel(tx,tenantId,data.personnelId);const course=await tx.query.rmsTrainingCourses.findFirst({where:and(eq(rmsTrainingCourses.tenantId,tenantId),eq(rmsTrainingCourses.id,data.courseId),isNull(rmsTrainingCourses.deletedAt))});if(!course)throw new ForgeError("NOT_FOUND","Training course not found");const now=new Date();const expiresAt=data.expiresAt?new Date(data.expiresAt):(course.recurrenceMonths?new Date(new Date(data.completedAt).setMonth(new Date(data.completedAt).getMonth()+course.recurrenceMonths)):null);const [row]=await tx.insert(rmsTrainingRecords).values({id:createId(),tenantId,...data,completedAt:new Date(data.completedAt),expiresAt,hours:data.hours??course.defaultHours,createdByUserId:principal.userId,updatedByUserId:principal.userId,createdAt:now,updatedAt:now}).returning();if(!row)throw new ForgeError("INTERNAL_ERROR","Failed to create training record");await this.emit(tx,tenantId,"rms_training_record",row.id,"create",principal,row);return row;},principal.userId);
  }

  async listCertificationTypes(tenantId:string,query:Record<string,string>){
    const q=pageQuery(query);return withTenantTransaction(this.db,tenantId,async tx=>{const filters=[eq(rmsCertificationTypes.tenantId,tenantId),isNull(rmsCertificationTypes.deletedAt)];if(q.status)filters.push(eq(rmsCertificationTypes.status,q.status));if(q.search)filters.push(or(ilike(rmsCertificationTypes.code,`%${q.search}%`),ilike(rmsCertificationTypes.name,`%${q.search}%`))!);const where=and(...filters);const items=await tx.select().from(rmsCertificationTypes).where(where).orderBy(rmsCertificationTypes.code).limit(q.pageSize).offset((q.page-1)*q.pageSize);const totals=await tx.select({total:count()}).from(rmsCertificationTypes).where(where);return {items,page:q.page,pageSize:q.pageSize,total:totals[0]?.total??0};});
  }

  async createCertificationType(tenantId:string,input:unknown,principal:ForgePrincipal){
    const data=certificationTypeSchema.parse(input);return withTenantTransaction(this.db,tenantId,async tx=>{const now=new Date();const [row]=await tx.insert(rmsCertificationTypes).values({id:createId(),tenantId,...data,createdByUserId:principal.userId,updatedByUserId:principal.userId,createdAt:now,updatedAt:now}).returning();if(!row)throw new ForgeError("INTERNAL_ERROR","Failed to create certification type");await this.emit(tx,tenantId,"rms_certification_type",row.id,"create",principal,row);return row;},principal.userId);
  }

  async patchCertificationType(tenantId:string,id:string,input:unknown,principal:ForgePrincipal,expected:ExpectedVersion){
    const data=certificationTypeSchema.partial().parse(input);return withTenantTransaction(this.db,tenantId,async tx=>{const before=await tx.query.rmsCertificationTypes.findFirst({where:and(eq(rmsCertificationTypes.tenantId,tenantId),eq(rmsCertificationTypes.id,id),isNull(rmsCertificationTypes.deletedAt))});if(!before)throw new ForgeError("NOT_FOUND","Certification type not found");if(expected!=="*"&&before.recordVersion!==expected)throw concurrencyConflict({tenantId,resourceType:"rms_certification_type",resourceId:id,expectedVersion:expected,actualVersion:before.recordVersion});const [row]=await tx.update(rmsCertificationTypes).set({...data,recordVersion:before.recordVersion+1,updatedByUserId:principal.userId,updatedAt:new Date()}).where(and(eq(rmsCertificationTypes.id,id),eq(rmsCertificationTypes.recordVersion,before.recordVersion))).returning();if(!row)throw concurrencyConflict({tenantId,resourceType:"rms_certification_type",resourceId:id,expectedVersion:expected,actualVersion:null});await this.emit(tx,tenantId,"rms_certification_type",id,"update",principal,row,before);return row;},principal.userId);
  }

  async listPersonnelCertifications(tenantId:string,query:Record<string,string>){
    const q=pageQuery(query);return withTenantTransaction(this.db,tenantId,async tx=>{const filters=[eq(rmsPersonnelCertifications.tenantId,tenantId)];if(q.personnelId)filters.push(eq(rmsPersonnelCertifications.personnelId,q.personnelId));if(q.certificationTypeId)filters.push(eq(rmsPersonnelCertifications.certificationTypeId,q.certificationTypeId));if(q.status)filters.push(eq(rmsPersonnelCertifications.status,q.status));const where=and(...filters);const items=await tx.select().from(rmsPersonnelCertifications).where(where).orderBy(desc(rmsPersonnelCertifications.createdAt)).limit(q.pageSize).offset((q.page-1)*q.pageSize);const totals=await tx.select({total:count()}).from(rmsPersonnelCertifications).where(where);return {items,page:q.page,pageSize:q.pageSize,total:totals[0]?.total??0};});
  }

  async createPersonnelCertification(tenantId:string,input:unknown,principal:ForgePrincipal){
    const data=personnelCertificationSchema.parse(input);return withTenantTransaction(this.db,tenantId,async tx=>{await this.requirePersonnel(tx,tenantId,data.personnelId);const type=await tx.query.rmsCertificationTypes.findFirst({where:and(eq(rmsCertificationTypes.tenantId,tenantId),eq(rmsCertificationTypes.id,data.certificationTypeId),isNull(rmsCertificationTypes.deletedAt))});if(!type)throw new ForgeError("NOT_FOUND","Certification type not found");let expiresAt=data.expiresAt??null;if(!expiresAt&&data.issuedAt&&type.defaultValidityMonths){const d=new Date(data.issuedAt+"T00:00:00Z");d.setUTCMonth(d.getUTCMonth()+type.defaultValidityMonths);expiresAt=d.toISOString().slice(0,10);}const now=new Date();const [row]=await tx.insert(rmsPersonnelCertifications).values({id:createId(),tenantId,...data,expiresAt,verifiedAt:data.verifiedAt?new Date(data.verifiedAt):null,createdByUserId:principal.userId,updatedByUserId:principal.userId,createdAt:now,updatedAt:now}).returning();if(!row)throw new ForgeError("INTERNAL_ERROR","Failed to create personnel certification");await this.emit(tx,tenantId,"rms_personnel_certification",row.id,"create",principal,row);return row;},principal.userId);
  }

  async patchPersonnelCertification(tenantId:string,id:string,input:unknown,principal:ForgePrincipal,expected:ExpectedVersion){
    const data=personnelCertificationSchema.partial().parse(input);return withTenantTransaction(this.db,tenantId,async tx=>{const before=await tx.query.rmsPersonnelCertifications.findFirst({where:and(eq(rmsPersonnelCertifications.tenantId,tenantId),eq(rmsPersonnelCertifications.id,id))});if(!before)throw new ForgeError("NOT_FOUND","Personnel certification not found");if(expected!=="*"&&before.recordVersion!==expected)throw concurrencyConflict({tenantId,resourceType:"rms_personnel_certification",resourceId:id,expectedVersion:expected,actualVersion:before.recordVersion});const values:any={...data,recordVersion:before.recordVersion+1,updatedByUserId:principal.userId,updatedAt:new Date()};if(data.verifiedAt!==undefined)values.verifiedAt=data.verifiedAt?new Date(data.verifiedAt):null;const [row]=await tx.update(rmsPersonnelCertifications).set(values).where(and(eq(rmsPersonnelCertifications.id,id),eq(rmsPersonnelCertifications.recordVersion,before.recordVersion))).returning();if(!row)throw concurrencyConflict({tenantId,resourceType:"rms_personnel_certification",resourceId:id,expectedVersion:expected,actualVersion:null});await this.emit(tx,tenantId,"rms_personnel_certification",id,"update",principal,row,before);return row;},principal.userId);
  }

  async readiness(tenantId:string,personnelId:string){
    return withTenantTransaction(this.db,tenantId,async tx=>{await this.requirePersonnel(tx,tenantId,personnelId);const now=new Date();const today=now.toISOString().slice(0,10);const requiredCourses=await tx.query.rmsTrainingCourses.findMany({where:and(eq(rmsTrainingCourses.tenantId,tenantId),eq(rmsTrainingCourses.status,"ACTIVE"),eq(rmsTrainingCourses.requiredForIncidentEligibility,true),isNull(rmsTrainingCourses.deletedAt))});const records=await tx.query.rmsTrainingRecords.findMany({where:and(eq(rmsTrainingRecords.tenantId,tenantId),eq(rmsTrainingRecords.personnelId,personnelId),eq(rmsTrainingRecords.status,"COMPLETED")),orderBy:[desc(rmsTrainingRecords.completedAt)]});const training=requiredCourses.map(course=>{const record=records.find(r=>r.courseId===course.id);const current=!!record&&(!record.expiresAt||record.expiresAt>now);return {courseId:course.id,code:course.code,title:course.title,current,completedAt:record?.completedAt??null,expiresAt:record?.expiresAt??null};});const requiredTypes=await tx.query.rmsCertificationTypes.findMany({where:and(eq(rmsCertificationTypes.tenantId,tenantId),eq(rmsCertificationTypes.status,"ACTIVE"),eq(rmsCertificationTypes.requiredForIncidentEligibility,true),isNull(rmsCertificationTypes.deletedAt))});const certs=await tx.query.rmsPersonnelCertifications.findMany({where:and(eq(rmsPersonnelCertifications.tenantId,tenantId),eq(rmsPersonnelCertifications.personnelId,personnelId),eq(rmsPersonnelCertifications.status,"ACTIVE")),orderBy:[desc(rmsPersonnelCertifications.createdAt)]});const certifications=requiredTypes.map(type=>{const record=certs.find(r=>r.certificationTypeId===type.id);const current=!!record&&(!record.expiresAt||record.expiresAt>=today);return {certificationTypeId:type.id,code:type.code,name:type.name,current,credentialNumber:record?.credentialNumber??null,expiresAt:record?.expiresAt??null};});const missingTraining=training.filter(x=>!x.current);const missingCertifications=certifications.filter(x=>!x.current);return {personnelId,eligible:missingTraining.length===0&&missingCertifications.length===0,training,certifications,missingTraining,missingCertifications,computedAt:now.toISOString()};});
  }

  private async requirePersonnel(tx:Parameters<Parameters<typeof withTenantTransaction>[2]>[0],tenantId:string,personnelId:string){const person=await tx.query.rmsPersonnel.findFirst({where:and(eq(rmsPersonnel.tenantId,tenantId),eq(rmsPersonnel.id,personnelId),isNull(rmsPersonnel.deletedAt))});if(!person)throw new ForgeError("NOT_FOUND","Personnel record not found");return person;}

  private async emit(tx:Parameters<Parameters<typeof withTenantTransaction>[2]>[0],tenantId:string,resourceType:string,resourceId:string,action:string,principal:ForgePrincipal,after?:unknown,before?:unknown){
    await this.outbox.write(tx,{tenantId,aggregateType:resourceType,aggregateId:resourceId,eventType:DOMAIN_EVENT_TYPES.RMS_MASTERDATA_UPDATED,payload:{tenantId,resourceType,resourceId,action},correlationId:principal.correlationId,actorUserId:principal.userId});
    await this.audit.writeInTransaction(tx,{tenantId,actorUserId:principal.userId,actorPersonId:principal.personId,actorType:"USER",action:`rms.training.${action}`,resourceType,resourceId,result:"SUCCESS",riskLevel:"MEDIUM",correlationId:principal.correlationId,requestId:principal.requestId,before,after});
  }
}
