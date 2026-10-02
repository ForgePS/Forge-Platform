import {Body,Controller,Get,Param,Patch,Post,Query,Req,Res} from "@nestjs/common";
import type {ForgePrincipal} from "@forge/tenant-context";
import type {Response} from "express";
import {ok} from "../../common/api-response.js";
import {requireIfMatch,setETag} from "../../common/concurrency.js";
import {Idempotent} from "../../common/idempotent.decorator.js";
import {getRequestIds,type RequestWithIds} from "../../common/request-ids.js";
import {Principal} from "../auth-context/principal.decorator.js";
import {RequirePermission} from "../auth-context/require-permission.decorator.js";
import {RmsInventoryService} from "./rms-inventory.service.js";

@Controller("api/v1/tenants/:tenantId/rms/inventory/items")
export class RmsInventoryItemsController{
 constructor(private readonly service:RmsInventoryService){}
 @Get() @RequirePermission("rms.masterdata.read")
 async list(@Param("tenantId") tenantId:string,@Query() query:Record<string,string>,@Req() req:RequestWithIds){const r=await this.service.listItems(tenantId,query);return ok(r.items,getRequestIds(req),{page:r.page,pageSize:r.pageSize,total:r.total});}
 @Post() @RequirePermission("rms.masterdata.manage") @Idempotent({resourceType:"rms_inventory_item"})
 async create(@Param("tenantId") tenantId:string,@Body() body:unknown,@Principal() principal:ForgePrincipal,@Req() req:RequestWithIds,@Res({passthrough:true}) res:Response){const data=await this.service.createItem(tenantId,body,principal);setETag(res,data.recordVersion);return ok(data,getRequestIds(req));}
 @Patch(":itemId") @RequirePermission("rms.masterdata.manage")
 async patch(@Param("tenantId") tenantId:string,@Param("itemId") itemId:string,@Body() body:unknown,@Principal() principal:ForgePrincipal,@Req() req:RequestWithIds,@Res({passthrough:true}) res:Response){const expected=requireIfMatch(req,"rms_inventory_item");const data=await this.service.patchItem(tenantId,itemId,body,principal,expected);setETag(res,data.recordVersion);return ok(data,getRequestIds(req));}
}

@Controller("api/v1/tenants/:tenantId/rms/inventory/locations")
export class RmsInventoryLocationsController{
 constructor(private readonly service:RmsInventoryService){}
 @Get() @RequirePermission("rms.masterdata.read")
 async list(@Param("tenantId") tenantId:string,@Query() query:Record<string,string>,@Req() req:RequestWithIds){const r=await this.service.listLocations(tenantId,query);return ok(r.items,getRequestIds(req),{page:r.page,pageSize:r.pageSize,total:r.total});}
 @Post() @RequirePermission("rms.masterdata.manage") @Idempotent({resourceType:"rms_inventory_location"})
 async create(@Param("tenantId") tenantId:string,@Body() body:unknown,@Principal() principal:ForgePrincipal,@Req() req:RequestWithIds,@Res({passthrough:true}) res:Response){const data=await this.service.createLocation(tenantId,body,principal);setETag(res,data.recordVersion);return ok(data,getRequestIds(req));}
 @Patch(":locationId") @RequirePermission("rms.masterdata.manage")
 async patch(@Param("tenantId") tenantId:string,@Param("locationId") locationId:string,@Body() body:unknown,@Principal() principal:ForgePrincipal,@Req() req:RequestWithIds,@Res({passthrough:true}) res:Response){const expected=requireIfMatch(req,"rms_inventory_location");const data=await this.service.patchLocation(tenantId,locationId,body,principal,expected);setETag(res,data.recordVersion);return ok(data,getRequestIds(req));}
}

@Controller("api/v1/tenants/:tenantId/rms/inventory")
export class RmsInventoryOperationsController{
 constructor(private readonly service:RmsInventoryService){}
 @Get("balances") @RequirePermission("rms.masterdata.read")
 async balances(@Param("tenantId") tenantId:string,@Query() query:Record<string,string>,@Req() req:RequestWithIds){return ok(await this.service.listBalances(tenantId,query),getRequestIds(req));}
 @Get("transactions") @RequirePermission("rms.masterdata.read")
 async transactions(@Param("tenantId") tenantId:string,@Query() query:Record<string,string>,@Req() req:RequestWithIds){return ok(await this.service.listTransactions(tenantId,query),getRequestIds(req));}
 @Get("low-stock") @RequirePermission("rms.masterdata.read")
 async lowStock(@Param("tenantId") tenantId:string,@Req() req:RequestWithIds){return ok(await this.service.lowStock(tenantId),getRequestIds(req));}
 @Post("transactions") @RequirePermission("rms.masterdata.manage") @Idempotent({resourceType:"rms_inventory_transaction"})
 async transact(@Param("tenantId") tenantId:string,@Body() body:unknown,@Principal() principal:ForgePrincipal,@Req() req:RequestWithIds){return ok(await this.service.transact(tenantId,body,principal),getRequestIds(req));}
}
