import {
  createId,
  getSharedDatabase,
  rmsHydrantDamageReports,
  rmsHydrantFlowTests,
  rmsHydrantInspections,
  rmsHydrants,
  withTenantTransaction,
  type Database,
} from "@forge/database";
import type {
  AdapterBatchContext,
  AdapterExecutionContext,
  AdapterRollbackContext,
  CompensationResult,
  ImportRecordAdapter,
  ImportRecordResult,
  ImportRollbackJournalEntry,
  NormalizedImportRecord,
} from "@forge/imports";
import { and, eq, isNull } from "drizzle-orm";

export const RMS_HYDRANT_IMPORT_ADAPTER_KEY = "FORGE_RMS:HYDRANTS:hydrant@1";

type HistoryRecord = Record<string, unknown>;

type HydrantMapped = Record<string, unknown> & {
  sourceHydrantId?: string;
  displayId?: string;
  flowTests?: HistoryRecord[];
  inspections?: HistoryRecord[];
  damageReports?: HistoryRecord[];
};

function text(value: unknown): string | null {
  if (value == null || value === "") return null;
  return String(value);
}
function num(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
function bool(value: unknown): boolean | null {
  if (value == null || value === "") return null;
  if (typeof value === "boolean") return value;
  const normalized = String(value).toLowerCase();
  if (["true","yes","1"].includes(normalized)) return true;
  if (["false","no","0"].includes(normalized)) return false;
  return null;
}
function dateOnly(value: unknown): string | null {
  const valueText = text(value);
  return valueText ? valueText.slice(0,10) : null;
}
function instant(value: unknown): Date | null {
  const valueText = text(value);
  if (!valueText) return null;
  const parsed = new Date(valueText);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
function historyArray(value: unknown): HistoryRecord[] {
  return Array.isArray(value) ? value.filter((item): item is HistoryRecord => !!item && typeof item === "object" && !Array.isArray(item)) : [];
}

export class RmsHydrantImportAdapter implements ImportRecordAdapter {
  readonly key = RMS_HYDRANT_IMPORT_ADAPTER_KEY;
  readonly version = "1";

  constructor(private readonly db: Database) {}

  async validateExecutionContext(context: AdapterExecutionContext): Promise<void> {
    if (context.productCode !== "FORGE_RMS" || context.moduleCode !== "HYDRANTS" || context.recordType !== "hydrant") {
      const error = new Error("Hydrant adapter received incompatible import context");
      Object.assign(error,{failureClass:"NON_RETRIABLE_JOB"});
      throw error;
    }
  }

  async prepareBatch(context: AdapterBatchContext): Promise<AdapterBatchContext> {
    return context;
  }

  async executeRecord(record: NormalizedImportRecord, context: AdapterExecutionContext): Promise<ImportRecordResult> {
    const mapped = record.mapped as HydrantMapped;
    const displayId = text(mapped.displayId ?? mapped.display_id);
    if (!displayId) return this.failure("HYDRANT_DISPLAY_ID_REQUIRED","Hydrant displayId is required.");

    return withTenantTransaction(this.db, context.tenantId, async (tx) => {
      const existing = await tx.query.rmsHydrants.findFirst({
        where: and(eq(rmsHydrants.tenantId,context.tenantId),eq(rmsHydrants.displayId,displayId),isNull(rmsHydrants.deletedAt)),
      });
      if (existing) {
        return {
          outcome:"DUPLICATE",
          destinationRecordId:existing.id,
          operationType:"SKIP_DUPLICATE",
          rollbackClassification:"NOT_REVERSIBLE",
          afterRef:{hydrantId:existing.id,displayId:existing.displayId},
        };
      }

      const hydrantId=createId();
      const now=new Date();
      const [hydrant]=await tx.insert(rmsHydrants).values({
        id:hydrantId,
        tenantId:context.tenantId,
        displayId,
        officialHydrantId:text(mapped.officialHydrantId),
        locationId:text(mapped.locationId),
        district:text(mapped.district),
        addressLine1:text(mapped.addressLine1 ?? mapped.address),
        city:text(mapped.city),
        state:text(mapped.state),
        postalCode:text(mapped.postalCode),
        latitude:num(mapped.latitude),
        longitude:num(mapped.longitude),
        status:text(mapped.status) ?? "UNKNOWN",
        waterProvider:text(mapped.waterProvider ?? mapped.provider),
        waterAssociation:text(mapped.waterAssociation ?? mapped.waterAssoc),
        subdivision:text(mapped.subdivision),
        dischargeSize:num(mapped.dischargeSize),
        hydrantType:text(mapped.hydrantType),
        manufacturer:text(mapped.manufacturer),
        model:text(mapped.model),
        installDate:dateOnly(mapped.installDate),
        lastInspectionDate:dateOnly(mapped.lastInspectionDate),
        lastFlowTestDate:dateOnly(mapped.lastFlowTestDate),
        flowGpm:num(mapped.flowGpm),
        staticPsi:num(mapped.staticPsi),
        residualPsi:num(mapped.residualPsi),
        nfpaClass:text(mapped.nfpaClass),
        nfpaColor:text(mapped.nfpaColor),
        issue:text(mapped.issue),
        alternateSupply:text(mapped.alternateSupply),
        notes:text(mapped.notes),
        recordVersion:1,
        createdAt:now,
        updatedAt:now,
      }).returning();
      if(!hydrant)return this.failure("HYDRANT_CREATE_FAILED","Hydrant insert returned no row.");

      const flowTests=historyArray(mapped.flowTests);
      const inspections=historyArray(mapped.inspections);
      const damageReports=historyArray(mapped.damageReports);

      for(const item of flowTests){
        const testDate=dateOnly(item.testDate ?? item.test_date ?? item.date);
        const flowGpm=num(item.flowGpm ?? item.flow_gpm ?? item.gpm ?? item.flow);
        if(!testDate||flowGpm==null)continue;
        await tx.insert(rmsHydrantFlowTests).values({
          id:createId(),tenantId:context.tenantId,hydrantId,testDate,
          staticPsi:num(item.staticPsi ?? item.static_pressure),
          residualPsi:num(item.residualPsi ?? item.residual_pressure),
          pitotPsi:num(item.pitotPsi ?? item.pitot_pressure),
          dischargeSize:num(item.dischargeSize ?? item.outletDiameter),
          flowGpm,nfpaClass:text(item.nfpaClass),nfpaColor:text(item.nfpaColor),
          testedBy:text(item.testedBy),shift:text(item.shift),flowResult:text(item.flowResult),
          status:text(item.status),notes:text(item.notes),createdAt:instant(item.createdAt) ?? now,
        });
      }

      for(const item of inspections){
        const inspectionAt=instant(item.inspectionAt ?? item.inspectionDate ?? item.inspection_date ?? item.date);
        if(!inspectionAt)continue;
        await tx.insert(rmsHydrantInspections).values({
          id:createId(),tenantId:context.tenantId,hydrantId,inspectionAt,
          operationalStatus:text(item.operationalStatus ?? item.status) ?? "UNKNOWN",
          inspector:text(item.inspector ?? item.inspectedBy),
          checklistJson:(item.checklist && typeof item.checklist==="object" ? item.checklist : {}) as Record<string,unknown>,
          issueCount:num(item.issueCount) ?? 0,notes:text(item.notes),createdAt:instant(item.createdAt) ?? now,
        });
      }

      for(const item of damageReports){
        const reportedAt=instant(item.reportedAt ?? item.reported_at ?? item.date);
        if(!reportedAt)continue;
        await tx.insert(rmsHydrantDamageReports).values({
          id:createId(),tenantId:context.tenantId,hydrantId,reportedAt,
          severity:text(item.severity) ?? "UNKNOWN",
          operationalStatus:text(item.operationalStatus ?? item.status) ?? "UNKNOWN",
          leakPresent:bool(item.leakPresent),trafficHazard:bool(item.trafficHazard),
          alternateWaterSupply:text(item.alternateWaterSupply ?? item.alternateSupply),
          waterProvider:text(item.waterProvider ?? item.provider),
          workOrderReference:text(item.workOrderReference),
          reportedBy:text(item.reportedBy),notes:text(item.notes),createdAt:instant(item.createdAt) ?? now,
        });
      }

      return {
        outcome:"CREATED",
        destinationRecordId:hydrantId,
        operationType:"CREATE_HYDRANT_WITH_HISTORY",
        rollbackClassification:"FULLY_REVERSIBLE",
        beforeRef:{},
        afterRef:{hydrantId,displayId,sourceHydrantId:text(mapped.sourceHydrantId),flowTests:flowTests.length,inspections:inspections.length,damageReports:damageReports.length},
        compensation:{action:"DELETE_IMPORTED_HYDRANT",hydrantId},
      };
    });
  }

  async compensateRecord(journal: ImportRollbackJournalEntry, context: AdapterRollbackContext): Promise<CompensationResult> {
    const hydrantId=text(journal.destinationRecordId ?? journal.compensation?.hydrantId);
    if(!hydrantId)return {compensated:false,details:{reason:"missing_hydrant_id"}};
    return withTenantTransaction(this.db,context.tenantId,async(tx)=>{
      const existing=await tx.query.rmsHydrants.findFirst({where:and(eq(rmsHydrants.tenantId,context.tenantId),eq(rmsHydrants.id,hydrantId))});
      if(!existing)return {compensated:true,details:{alreadyAbsent:true,hydrantId}};
      await tx.delete(rmsHydrantDamageReports).where(and(eq(rmsHydrantDamageReports.tenantId,context.tenantId),eq(rmsHydrantDamageReports.hydrantId,hydrantId)));
      await tx.delete(rmsHydrantInspections).where(and(eq(rmsHydrantInspections.tenantId,context.tenantId),eq(rmsHydrantInspections.hydrantId,hydrantId)));
      await tx.delete(rmsHydrantFlowTests).where(and(eq(rmsHydrantFlowTests.tenantId,context.tenantId),eq(rmsHydrantFlowTests.hydrantId,hydrantId)));
      await tx.delete(rmsHydrants).where(and(eq(rmsHydrants.tenantId,context.tenantId),eq(rmsHydrants.id,hydrantId)));
      return {compensated:true,details:{hydrantId}};
    });
  }

  private failure(code:string,message:string):ImportRecordResult{
    return {outcome:"FAILED",operationType:"CREATE_HYDRANT_WITH_HISTORY",rollbackClassification:"NOT_REVERSIBLE",failureClass:"NON_RETRIABLE_ROW",errorCode:code,errorMessage:message};
  }
}

export function createRmsHydrantImportAdapter(databaseUrl:string):RmsHydrantImportAdapter{
  return new RmsHydrantImportAdapter(getSharedDatabase(databaseUrl));
}
