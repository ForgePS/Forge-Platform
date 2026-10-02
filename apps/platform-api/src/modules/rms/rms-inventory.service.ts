import {Inject,Injectable} from "@nestjs/common";
import {
  createId,
  rmsApparatus,
  rmsInventoryBalances,
  rmsInventoryItems,
  rmsInventoryLocations,
  rmsInventoryTransactions,
  rmsPersonnel,
  rmsStations,
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

const itemSchema=z.object({
  itemCode:z.string().min(1).max(80),
  name:z.string().min(1).max(240),
  category:z.string().max(80).default("GENERAL"),
  description:z.string().max(20000).optional().nullable(),
  unitOfMeasure:z.string().max(40).default("EA"),
  minimumQuantity:z.number().nonnegative().optional().nullable(),
  reorderQuantity:z.number().positive().optional().nullable(),
  trackingMode:z.enum(["QUANTITY","LOT","SERIAL"]).default("QUANTITY"),
  status:z.enum(["ACTIVE","INACTIVE","ARCHIVED"]).default("ACTIVE"),
});

const locationSchema=z.object({
  locationCode:z.string().min(1).max(80),
  name:z.string().min(1).max(240),
  locationType:z.enum(["WAREHOUSE","STATION","APPARATUS","PERSONNEL","OTHER"]).default("WAREHOUSE"),
  stationId:z.string().uuid().optional().nullable(),
  apparatusId:z.string().uuid().optional().nullable(),
  personnelId:z.string().uuid().optional().nullable(),
  status:z.enum(["ACTIVE","INACTIVE"]).default("ACTIVE"),
  notes:z.string().max(12000).optional().nullable(),
});

const transactionSchema=z.object({
  itemId:z.string().uuid(),
  transactionType:z.enum(["RECEIVE","ISSUE","TRANSFER","CONSUME","RETURN","ADJUST_IN","ADJUST_OUT"]),
  quantity:z.number().positive(),
  fromLocationId:z.string().uuid().optional().nullable(),
  toLocationId:z.string().uuid().optional().nullable(),
  occurredAt:z.string().datetime({offset:true}).optional(),
  lotNumber:z.string().max(120).optional().nullable(),
  expirationDate:z.string().date().optional().nullable(),
  serialNumber:z.string().max(160).optional().nullable(),
  reference:z.string().max(240).optional().nullable(),
  performedByPersonnelId:z.string().uuid().optional().nullable(),
  notes:z.string().max(12000).optional().nullable(),
});

function pageQuery(q:Record<string,string>){return {page:Math.max(1,Number(q.page||1)),pageSize:Math.min(500,Math.max(1,Number(q.pageSize||100))),search:String(q.search||"").trim(),status:String(q.status||"").trim(),category:String(q.category||"").trim(),itemId:String(q.itemId||"").trim(),locationId:String(q.locationId||"").trim()};}

@Injectable()
export class RmsInventoryService{
  constructor(@Inject(DATABASE) private readonly db:Database,private readonly outbox:OutboxService,private readonly audit:AuditService){}

  async listItems(tenantId:string,query:Record<string,string>){
    const q=pageQuery(query);return withTenantTransaction(this.db,tenantId,async tx=>{const filters=[eq(rmsInventoryItems.tenantId,tenantId),isNull(rmsInventoryItems.deletedAt)];if(q.status)filters.push(eq(rmsInventoryItems.status,q.status));if(q.category)filters.push(eq(rmsInventoryItems.category,q.category));if(q.search)filters.push(or(ilike(rmsInventoryItems.itemCode,`%${q.search}%`),ilike(rmsInventoryItems.name,`%${q.search}%`),ilike(rmsInventoryItems.category,`%${q.search}%`))!);const where=and(...filters);const items=await tx.select().from(rmsInventoryItems).where(where).orderBy(rmsInventoryItems.itemCode).limit(q.pageSize).offset((q.page-1)*q.pageSize);const totals=await tx.select({total:count()}).from(rmsInventoryItems).where(where);return {items,page:q.page,pageSize:q.pageSize,total:totals[0]?.total??0};});
  }

  async createItem(tenantId:string,input:unknown,principal:ForgePrincipal){
    const data=itemSchema.parse(input);return withTenantTransaction(this.db,tenantId,async tx=>{const now=new Date();const [row]=await tx.insert(rmsInventoryItems).values({id:createId(),tenantId,...data,createdByUserId:principal.userId,updatedByUserId:principal.userId,createdAt:now,updatedAt:now}).returning();if(!row)throw new ForgeError("INTERNAL_ERROR","Failed to create inventory item");await this.emit(tx,tenantId,"rms_inventory_item",row.id,"create",principal,row);return row;},principal.userId);
  }

  async patchItem(tenantId:string,id:string,input:unknown,principal:ForgePrincipal,expected:ExpectedVersion){
    const data=itemSchema.partial().parse(input);return withTenantTransaction(this.db,tenantId,async tx=>{const before=await tx.query.rmsInventoryItems.findFirst({where:and(eq(rmsInventoryItems.tenantId,tenantId),eq(rmsInventoryItems.id,id),isNull(rmsInventoryItems.deletedAt))});if(!before)throw new ForgeError("NOT_FOUND","Inventory item not found");if(expected!=="*"&&before.recordVersion!==expected)throw concurrencyConflict({tenantId,resourceType:"rms_inventory_item",resourceId:id,expectedVersion:expected,actualVersion:before.recordVersion});const [row]=await tx.update(rmsInventoryItems).set({...data,recordVersion:before.recordVersion+1,updatedByUserId:principal.userId,updatedAt:new Date()}).where(and(eq(rmsInventoryItems.id,id),eq(rmsInventoryItems.recordVersion,before.recordVersion))).returning();if(!row)throw concurrencyConflict({tenantId,resourceType:"rms_inventory_item",resourceId:id,expectedVersion:expected,actualVersion:null});await this.emit(tx,tenantId,"rms_inventory_item",id,"update",principal,row,before);return row;},principal.userId);
  }

  async listLocations(tenantId:string,query:Record<string,string>){
    const q=pageQuery(query);return withTenantTransaction(this.db,tenantId,async tx=>{const filters=[eq(rmsInventoryLocations.tenantId,tenantId),isNull(rmsInventoryLocations.deletedAt)];if(q.status)filters.push(eq(rmsInventoryLocations.status,q.status));if(q.search)filters.push(or(ilike(rmsInventoryLocations.locationCode,`%${q.search}%`),ilike(rmsInventoryLocations.name,`%${q.search}%`))!);const where=and(...filters);const items=await tx.select().from(rmsInventoryLocations).where(where).orderBy(rmsInventoryLocations.locationCode).limit(q.pageSize).offset((q.page-1)*q.pageSize);const totals=await tx.select({total:count()}).from(rmsInventoryLocations).where(where);return {items,page:q.page,pageSize:q.pageSize,total:totals[0]?.total??0};});
  }

  async createLocation(tenantId:string,input:unknown,principal:ForgePrincipal){
    const data=locationSchema.parse(input);return withTenantTransaction(this.db,tenantId,async tx=>{await this.validateLocationRef(tx,tenantId,data);const now=new Date();const [row]=await tx.insert(rmsInventoryLocations).values({id:createId(),tenantId,...data,createdByUserId:principal.userId,updatedByUserId:principal.userId,createdAt:now,updatedAt:now}).returning();if(!row)throw new ForgeError("INTERNAL_ERROR","Failed to create inventory location");await this.emit(tx,tenantId,"rms_inventory_location",row.id,"create",principal,row);return row;},principal.userId);
  }

  async patchLocation(tenantId:string,id:string,input:unknown,principal:ForgePrincipal,expected:ExpectedVersion){
    const data=locationSchema.partial().parse(input);return withTenantTransaction(this.db,tenantId,async tx=>{const before=await tx.query.rmsInventoryLocations.findFirst({where:and(eq(rmsInventoryLocations.tenantId,tenantId),eq(rmsInventoryLocations.id,id),isNull(rmsInventoryLocations.deletedAt))});if(!before)throw new ForgeError("NOT_FOUND","Inventory location not found");if(expected!=="*"&&before.recordVersion!==expected)throw concurrencyConflict({tenantId,resourceType:"rms_inventory_location",resourceId:id,expectedVersion:expected,actualVersion:before.recordVersion});const next={...before,...data};await this.validateLocationRef(tx,tenantId,next);const [row]=await tx.update(rmsInventoryLocations).set({...data,recordVersion:before.recordVersion+1,updatedByUserId:principal.userId,updatedAt:new Date()}).where(and(eq(rmsInventoryLocations.id,id),eq(rmsInventoryLocations.recordVersion,before.recordVersion))).returning();if(!row)throw concurrencyConflict({tenantId,resourceType:"rms_inventory_location",resourceId:id,expectedVersion:expected,actualVersion:null});await this.emit(tx,tenantId,"rms_inventory_location",id,"update",principal,row,before);return row;},principal.userId);
  }

  async listBalances(tenantId:string,query:Record<string,string>){
    const q=pageQuery(query);return withTenantTransaction(this.db,tenantId,async tx=>{const filters=[eq(rmsInventoryBalances.tenantId,tenantId)];if(q.itemId)filters.push(eq(rmsInventoryBalances.itemId,q.itemId));if(q.locationId)filters.push(eq(rmsInventoryBalances.locationId,q.locationId));return tx.select().from(rmsInventoryBalances).where(and(...filters)).orderBy(rmsInventoryBalances.locationId,rmsInventoryBalances.itemId).limit(q.pageSize).offset((q.page-1)*q.pageSize);});
  }

  async listTransactions(tenantId:string,query:Record<string,string>){
    const q=pageQuery(query);return withTenantTransaction(this.db,tenantId,async tx=>{const filters=[eq(rmsInventoryTransactions.tenantId,tenantId)];if(q.itemId)filters.push(eq(rmsInventoryTransactions.itemId,q.itemId));const where=and(...filters);const rows=await tx.select().from(rmsInventoryTransactions).where(where).orderBy(desc(rmsInventoryTransactions.occurredAt)).limit(q.pageSize).offset((q.page-1)*q.pageSize);return rows.filter(row=>!q.locationId||row.fromLocationId===q.locationId||row.toLocationId===q.locationId);});
  }

  async transact(tenantId:string,input:unknown,principal:ForgePrincipal){
    const data=transactionSchema.parse(input);return withTenantTransaction(this.db,tenantId,async tx=>{
      const item=await tx.query.rmsInventoryItems.findFirst({where:and(eq(rmsInventoryItems.tenantId,tenantId),eq(rmsInventoryItems.id,data.itemId),isNull(rmsInventoryItems.deletedAt))});if(!item)throw new ForgeError("NOT_FOUND","Inventory item not found");if(item.status!=="ACTIVE")throw new ForgeError("VALIDATION_ERROR","Inventory item is not active");
      if(item.trackingMode==="SERIAL"&&(data.quantity!==1||!data.serialNumber))throw new ForgeError("VALIDATION_ERROR","Serial-tracked inventory requires quantity 1 and a serial number");
      if(item.trackingMode==="LOT"&&!data.lotNumber)throw new ForgeError("VALIDATION_ERROR","Lot-tracked inventory requires a lot number");
      const inbound=["RECEIVE","RETURN","ADJUST_IN"].includes(data.transactionType);
      const outbound=["ISSUE","CONSUME","ADJUST_OUT"].includes(data.transactionType);
      const transfer=data.transactionType==="TRANSFER";
      if((inbound||transfer)&&!data.toLocationId)throw new ForgeError("VALIDATION_ERROR","Destination location is required");
      if((outbound||transfer)&&!data.fromLocationId)throw new ForgeError("VALIDATION_ERROR","Source location is required");
      if(transfer&&data.fromLocationId===data.toLocationId)throw new ForgeError("VALIDATION_ERROR","Transfer source and destination must differ");
      if(data.fromLocationId)await this.requireLocation(tx,tenantId,data.fromLocationId);
      if(data.toLocationId)await this.requireLocation(tx,tenantId,data.toLocationId);
      if(data.performedByPersonnelId)await this.requirePersonnel(tx,tenantId,data.performedByPersonnelId);
      if(outbound||transfer)await this.adjustBalance(tx,tenantId,data.itemId,data.fromLocationId!,-data.quantity);
      if(inbound||transfer)await this.adjustBalance(tx,tenantId,data.itemId,data.toLocationId!,data.quantity);
      const now=new Date();const [row]=await tx.insert(rmsInventoryTransactions).values({id:createId(),tenantId,...data,occurredAt:data.occurredAt?new Date(data.occurredAt):now,createdByUserId:principal.userId,createdAt:now}).returning();if(!row)throw new ForgeError("INTERNAL_ERROR","Failed to record inventory transaction");await this.emit(tx,tenantId,"rms_inventory_transaction",row.id,"create",principal,row);return row;
    },principal.userId);
  }

  async lowStock(tenantId:string){
    return withTenantTransaction(this.db,tenantId,async tx=>{
      const items=await tx.query.rmsInventoryItems.findMany({where:and(eq(rmsInventoryItems.tenantId,tenantId),eq(rmsInventoryItems.status,"ACTIVE"),isNull(rmsInventoryItems.deletedAt))});
      const balances=await tx.query.rmsInventoryBalances.findMany({where:eq(rmsInventoryBalances.tenantId,tenantId)});
      return items.flatMap(item=>{if(item.minimumQuantity==null)return [];const total=balances.filter(b=>b.itemId===item.id).reduce((sum,b)=>sum+b.quantity,0);return total<=item.minimumQuantity?[{itemId:item.id,itemCode:item.itemCode,name:item.name,totalQuantity:total,minimumQuantity:item.minimumQuantity,reorderQuantity:item.reorderQuantity,unitOfMeasure:item.unitOfMeasure}]:[];}).sort((a,b)=>a.totalQuantity-b.totalQuantity);
    });
  }

  private async adjustBalance(tx:Parameters<Parameters<typeof withTenantTransaction>[2]>[0],tenantId:string,itemId:string,locationId:string,delta:number){
    const before=await tx.query.rmsInventoryBalances.findFirst({where:and(eq(rmsInventoryBalances.tenantId,tenantId),eq(rmsInventoryBalances.itemId,itemId),eq(rmsInventoryBalances.locationId,locationId))});
    const next=(before?.quantity??0)+delta;if(next<0)throw new ForgeError("VALIDATION_ERROR","Inventory transaction would create negative stock");
    if(before){await tx.update(rmsInventoryBalances).set({quantity:next,recordVersion:before.recordVersion+1,updatedAt:new Date()}).where(and(eq(rmsInventoryBalances.id,before.id),eq(rmsInventoryBalances.recordVersion,before.recordVersion)));}
    else{await tx.insert(rmsInventoryBalances).values({id:createId(),tenantId,itemId,locationId,quantity:next,recordVersion:1,updatedAt:new Date()});}
  }

  private async validateLocationRef(tx:Parameters<Parameters<typeof withTenantTransaction>[2]>[0],tenantId:string,data:{locationType:string;stationId?:string|null;apparatusId?:string|null;personnelId?:string|null}){
    if(data.locationType==="STATION"){if(!data.stationId)throw new ForgeError("VALIDATION_ERROR","Station inventory location requires stationId");const row=await tx.query.rmsStations.findFirst({where:and(eq(rmsStations.tenantId,tenantId),eq(rmsStations.id,data.stationId),isNull(rmsStations.deletedAt))});if(!row)throw new ForgeError("NOT_FOUND","Station not found");}
    if(data.locationType==="APPARATUS"){if(!data.apparatusId)throw new ForgeError("VALIDATION_ERROR","Apparatus inventory location requires apparatusId");const row=await tx.query.rmsApparatus.findFirst({where:and(eq(rmsApparatus.tenantId,tenantId),eq(rmsApparatus.id,data.apparatusId),isNull(rmsApparatus.deletedAt))});if(!row)throw new ForgeError("NOT_FOUND","Apparatus not found");}
    if(data.locationType==="PERSONNEL"){if(!data.personnelId)throw new ForgeError("VALIDATION_ERROR","Personnel inventory location requires personnelId");await this.requirePersonnel(tx,tenantId,data.personnelId);}
  }

  private async requireLocation(tx:Parameters<Parameters<typeof withTenantTransaction>[2]>[0],tenantId:string,id:string){const row=await tx.query.rmsInventoryLocations.findFirst({where:and(eq(rmsInventoryLocations.tenantId,tenantId),eq(rmsInventoryLocations.id,id),eq(rmsInventoryLocations.status,"ACTIVE"),isNull(rmsInventoryLocations.deletedAt))});if(!row)throw new ForgeError("NOT_FOUND","Inventory location not found or inactive");return row;}
  private async requirePersonnel(tx:Parameters<Parameters<typeof withTenantTransaction>[2]>[0],tenantId:string,id:string){const row=await tx.query.rmsPersonnel.findFirst({where:and(eq(rmsPersonnel.tenantId,tenantId),eq(rmsPersonnel.id,id),isNull(rmsPersonnel.deletedAt))});if(!row)throw new ForgeError("NOT_FOUND","Personnel record not found");return row;}

  private async emit(tx:Parameters<Parameters<typeof withTenantTransaction>[2]>[0],tenantId:string,resourceType:string,resourceId:string,action:string,principal:ForgePrincipal,after?:unknown,before?:unknown){
    await this.outbox.write(tx,{tenantId,aggregateType:resourceType,aggregateId:resourceId,eventType:DOMAIN_EVENT_TYPES.RMS_MASTERDATA_UPDATED,payload:{tenantId,resourceType,resourceId,action},correlationId:principal.correlationId,actorUserId:principal.userId});
    await this.audit.writeInTransaction(tx,{tenantId,actorUserId:principal.userId,actorPersonId:principal.personId,actorType:"USER",action:`rms.inventory.${action}`,resourceType,resourceId,result:"SUCCESS",riskLevel:"MEDIUM",correlationId:principal.correlationId,requestId:principal.requestId,before,after});
  }
}
