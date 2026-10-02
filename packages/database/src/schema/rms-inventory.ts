import {
  date,
  doublePrecision,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import {createdAtColumn,recordVersionColumn,updatedAtColumn} from "./common.js";
import {rmsApparatus,rmsPersonnel,rmsStations} from "./rms-master.js";
import {tenants} from "./tenants.js";

export const rmsInventoryItems=pgTable("rms_inventory_items",{
  id:uuid("id").primaryKey(),
  tenantId:uuid("tenant_id").notNull().references(()=>tenants.id),
  itemCode:varchar("item_code",{length:80}).notNull(),
  name:varchar("name",{length:240}).notNull(),
  category:varchar("category",{length:80}).notNull().default("GENERAL"),
  description:text("description"),
  unitOfMeasure:varchar("unit_of_measure",{length:40}).notNull().default("EA"),
  minimumQuantity:doublePrecision("minimum_quantity"),
  reorderQuantity:doublePrecision("reorder_quantity"),
  trackingMode:varchar("tracking_mode",{length:32}).notNull().default("QUANTITY"),
  status:varchar("status",{length:32}).notNull().default("ACTIVE"),
  recordVersion:recordVersionColumn,
  createdByUserId:uuid("created_by_user_id"),
  updatedByUserId:uuid("updated_by_user_id"),
  createdAt:createdAtColumn,
  updatedAt:updatedAtColumn,
  deletedAt:timestamp("deleted_at",{withTimezone:true}),
  deletedByUserId:uuid("deleted_by_user_id"),
},table=>[
  uniqueIndex("rms_inventory_items_tenant_code_uidx").on(table.tenantId,table.itemCode),
  index("rms_inventory_items_tenant_status_idx").on(table.tenantId,table.status),
  index("rms_inventory_items_category_idx").on(table.tenantId,table.category),
]);

export const rmsInventoryLocations=pgTable("rms_inventory_locations",{
  id:uuid("id").primaryKey(),
  tenantId:uuid("tenant_id").notNull().references(()=>tenants.id),
  locationCode:varchar("location_code",{length:80}).notNull(),
  name:varchar("name",{length:240}).notNull(),
  locationType:varchar("location_type",{length:48}).notNull().default("WAREHOUSE"),
  stationId:uuid("station_id").references(()=>rmsStations.id),
  apparatusId:uuid("apparatus_id").references(()=>rmsApparatus.id),
  personnelId:uuid("personnel_id").references(()=>rmsPersonnel.id),
  status:varchar("status",{length:32}).notNull().default("ACTIVE"),
  notes:text("notes"),
  recordVersion:recordVersionColumn,
  createdByUserId:uuid("created_by_user_id"),
  updatedByUserId:uuid("updated_by_user_id"),
  createdAt:createdAtColumn,
  updatedAt:updatedAtColumn,
  deletedAt:timestamp("deleted_at",{withTimezone:true}),
  deletedByUserId:uuid("deleted_by_user_id"),
},table=>[
  uniqueIndex("rms_inventory_locations_tenant_code_uidx").on(table.tenantId,table.locationCode),
  index("rms_inventory_locations_type_idx").on(table.tenantId,table.locationType),
]);

export const rmsInventoryBalances=pgTable("rms_inventory_balances",{
  id:uuid("id").primaryKey(),
  tenantId:uuid("tenant_id").notNull().references(()=>tenants.id),
  itemId:uuid("item_id").notNull().references(()=>rmsInventoryItems.id),
  locationId:uuid("location_id").notNull().references(()=>rmsInventoryLocations.id),
  quantity:doublePrecision("quantity").notNull().default(0),
  recordVersion:recordVersionColumn,
  updatedAt:updatedAtColumn,
},table=>[
  uniqueIndex("rms_inventory_balances_item_location_uidx").on(table.tenantId,table.itemId,table.locationId),
  index("rms_inventory_balances_location_idx").on(table.tenantId,table.locationId),
  index("rms_inventory_balances_item_idx").on(table.tenantId,table.itemId),
]);

export const rmsInventoryTransactions=pgTable("rms_inventory_transactions",{
  id:uuid("id").primaryKey(),
  tenantId:uuid("tenant_id").notNull().references(()=>tenants.id),
  itemId:uuid("item_id").notNull().references(()=>rmsInventoryItems.id),
  transactionType:varchar("transaction_type",{length:48}).notNull(),
  quantity:doublePrecision("quantity").notNull(),
  fromLocationId:uuid("from_location_id").references(()=>rmsInventoryLocations.id),
  toLocationId:uuid("to_location_id").references(()=>rmsInventoryLocations.id),
  occurredAt:timestamp("occurred_at",{withTimezone:true}).notNull(),
  lotNumber:varchar("lot_number",{length:120}),
  expirationDate:date("expiration_date"),
  serialNumber:varchar("serial_number",{length:160}),
  reference:varchar("reference",{length:240}),
  performedByPersonnelId:uuid("performed_by_personnel_id").references(()=>rmsPersonnel.id),
  notes:text("notes"),
  createdByUserId:uuid("created_by_user_id"),
  createdAt:createdAtColumn,
},table=>[
  index("rms_inventory_transactions_item_time_idx").on(table.tenantId,table.itemId,table.occurredAt),
  index("rms_inventory_transactions_from_idx").on(table.tenantId,table.fromLocationId,table.occurredAt),
  index("rms_inventory_transactions_to_idx").on(table.tenantId,table.toLocationId,table.occurredAt),
]);
