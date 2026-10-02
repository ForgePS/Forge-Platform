import {
  getSharedDatabase,
  importExecutionJournal,
  importJobs,
  importRollbackEvents,
  withTenantTransaction,
} from "@forge/database";
import {
  ImportAdapterRegistry,
  ReferenceImportAdapter,
  validateImportRollbackMessage,
  type ImportRollbackJournalEntry,
} from "@forge/imports";
import { createLogger } from "@forge/observability";
import { and, desc, eq } from "drizzle-orm";
import { createRmsHydrantImportAdapter } from "./rms-hydrant-import-adapter.js";

export type ImportRollbackOutcome="completed"|"retry"|"rejected";

function createRollbackRegistry(databaseUrl:string):ImportAdapterRegistry{
  const registry=new ImportAdapterRegistry();
  registry.register(new ReferenceImportAdapter("reference:generic:record@1"));
  registry.register(createRmsHydrantImportAdapter(databaseUrl));
  return registry;
}

export async function processImportRollbackJob(input:{
  raw:unknown;
  databaseUrl:string;
  registry?:ImportAdapterRegistry;
}):Promise<ImportRollbackOutcome>{
  const logger=createLogger({service:"worker-service",environment:process.env.APP_ENV??"development"});
  const validated=validateImportRollbackMessage(input.raw);
  if(!validated.ok){
    logger.warn("import rollback message rejected",{reason:validated.reason,code:validated.code});
    return "rejected";
  }
  const message=validated.message;
  const db=getSharedDatabase(input.databaseUrl);
  const registry=input.registry??createRollbackRegistry(input.databaseUrl);

  try{
    const prepared=await withTenantTransaction(db,message.tenantId,async(tx)=>{
      const job=await tx.query.importJobs.findFirst({
        where:and(eq(importJobs.tenantId,message.tenantId),eq(importJobs.id,message.jobId)),
      });
      const event=await tx.query.importRollbackEvents.findFirst({
        where:and(
          eq(importRollbackEvents.tenantId,message.tenantId),
          eq(importRollbackEvents.jobId,message.jobId),
          eq(importRollbackEvents.id,message.rollbackEventId),
        ),
      });
      if(!job||!event)return {reject:true as const};
      if(job.status==="ROLLED_BACK"&&event.status==="COMPLETED")return {done:true as const};
      if(job.status!=="ROLLBACK_PENDING"||event.status!=="REQUESTED")return {reject:true as const};
      if(event.safetyClass==="UNSAFE"||event.classification==="NOT_REVERSIBLE")return {reject:true as const};

      const journal=await tx.query.importExecutionJournal.findMany({
        where:and(eq(importExecutionJournal.tenantId,message.tenantId),eq(importExecutionJournal.jobId,message.jobId)),
        orderBy:[desc(importExecutionJournal.committedAt)],
        limit:5000,
      });
      return {job,event,journal};
    });
    if("done" in prepared&&prepared.done)return "completed";
    if("reject" in prepared&&prepared.reject)return "rejected";
    if(!("journal" in prepared))return "rejected";

    const failures:Array<{journalId:string;reason:string}>=[];
    let compensated=0;
    for(const entry of prepared.journal){
      if(entry.rollbackClassification==="NOT_REVERSIBLE"||entry.rollbackClassification==="MANUAL_REVIEW_REQUIRED"){
        failures.push({journalId:entry.id,reason:`classification_${entry.rollbackClassification.toLowerCase()}`});
        continue;
      }
      let adapter;
      try{adapter=registry.resolve(entry.adapterKey);}
      catch{failures.push({journalId:entry.id,reason:"adapter_missing"});continue;}
      if(!adapter.compensateRecord){
        failures.push({journalId:entry.id,reason:"adapter_compensation_not_supported"});
        continue;
      }
      const journalEntry:ImportRollbackJournalEntry={
        rowId:entry.rowId??entry.id,
        ...(entry.destinationRecordId?{destinationRecordId:entry.destinationRecordId}:{}),
        operationType:entry.operationType,
        rollbackClassification:entry.rollbackClassification as ImportRollbackJournalEntry["rollbackClassification"],
        beforeRef:entry.beforeRefJson,
        afterRef:entry.afterRefJson,
        compensation:entry.compensationJson,
        adapterKey:entry.adapterKey,
        adapterVersion:entry.adapterVersion,
        committedAt:entry.committedAt.toISOString(),
        correlationId:entry.correlationId??message.correlationId,
      };
      try{
        const result=await adapter.compensateRecord(journalEntry,{
          tenantId:message.tenantId,jobId:message.jobId,correlationId:message.correlationId,
        });
        if(result.compensated)compensated+=1;
        else failures.push({journalId:entry.id,reason:String(result.details?.reason??"compensation_failed")});
      }catch(error){
        failures.push({journalId:entry.id,reason:error instanceof Error?error.message:"compensation_failed"});
      }
    }

    await withTenantTransaction(db,message.tenantId,async(tx)=>{
      const now=new Date();
      if(failures.length===0){
        await tx.update(importRollbackEvents).set({
          status:"COMPLETED",completedAt:now,effectiveAt:now,
          journalJson:prepared.journal.map(j=>({id:j.id,status:"COMPENSATED"})),
          version:prepared.event.version+1,updatedAt:now,
        }).where(and(eq(importRollbackEvents.tenantId,message.tenantId),eq(importRollbackEvents.id,message.rollbackEventId)));
        await tx.update(importJobs).set({
          status:"ROLLED_BACK",currentStage:"ROLLED_BACK",completedAt:now,
          version:prepared.job.version+1,updatedAt:now,
        }).where(and(eq(importJobs.tenantId,message.tenantId),eq(importJobs.id,message.jobId)));
      }else{
        await tx.update(importRollbackEvents).set({
          status:"FAILED",completedAt:now,
          journalJson:[...prepared.journal.map(j=>({id:j.id})),...failures],
          version:prepared.event.version+1,updatedAt:now,
        }).where(and(eq(importRollbackEvents.tenantId,message.tenantId),eq(importRollbackEvents.id,message.rollbackEventId)));
        await tx.update(importJobs).set({
          status:"ROLLBACK_PENDING",currentStage:"ROLLBACK_FAILED",
          errorSummary:`Rollback compensation incomplete: ${failures.length} failure(s); ${compensated} compensated.`,
          version:prepared.job.version+1,updatedAt:now,
        }).where(and(eq(importJobs.tenantId,message.tenantId),eq(importJobs.id,message.jobId)));
      }
    });
    return failures.length===0?"completed":"rejected";
  }catch(error){
    logger.error("import rollback failed",{error,jobId:message.jobId,rollbackEventId:message.rollbackEventId});
    return "retry";
  }
}
