CREATE TABLE IF NOT EXISTS "rms_equipment" (
  "id" uuid PRIMARY KEY,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "asset_tag" varchar(64) NOT NULL,
  "name" varchar(200) NOT NULL,
  "category" varchar(120) NOT NULL,
  "serial_number" varchar(120),
  "manufacturer" varchar(120),
  "model" varchar(120),
  "status" varchar(32) NOT NULL DEFAULT 'IN_SERVICE',
  "station_id" uuid REFERENCES "rms_stations"("id"),
  "apparatus_id" uuid REFERENCES "rms_apparatus"("id"),
  "personnel_id" uuid REFERENCES "rms_personnel"("id"),
  "storage_location" varchar(200),
  "purchase_date" date,
  "in_service_date" date,
  "expiration_date" date,
  "last_service_date" date,
  "next_service_date" date,
  "notes" text,
  "record_version" integer NOT NULL DEFAULT 1,
  "created_by_user_id" uuid,
  "updated_by_user_id" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "deleted_by_user_id" uuid
);
CREATE UNIQUE INDEX IF NOT EXISTS "rms_equipment_tenant_asset_tag_uidx" ON "rms_equipment" ("tenant_id","asset_tag");
CREATE INDEX IF NOT EXISTS "rms_equipment_tenant_status_idx" ON "rms_equipment" ("tenant_id","status");
CREATE INDEX IF NOT EXISTS "rms_equipment_station_idx" ON "rms_equipment" ("station_id");
CREATE INDEX IF NOT EXISTS "rms_equipment_apparatus_idx" ON "rms_equipment" ("apparatus_id");
CREATE INDEX IF NOT EXISTS "rms_equipment_personnel_idx" ON "rms_equipment" ("personnel_id");

CREATE TABLE IF NOT EXISTS "rms_equipment_assignment_history" (
  "id" uuid PRIMARY KEY,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "equipment_id" uuid NOT NULL REFERENCES "rms_equipment"("id"),
  "assignment_type" varchar(32) NOT NULL,
  "station_id" uuid REFERENCES "rms_stations"("id"),
  "apparatus_id" uuid REFERENCES "rms_apparatus"("id"),
  "personnel_id" uuid REFERENCES "rms_personnel"("id"),
  "storage_location" varchar(200),
  "assigned_at" timestamptz NOT NULL,
  "released_at" timestamptz,
  "notes" text,
  "created_by_user_id" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "rms_equipment_assignment_history_equipment_idx" ON "rms_equipment_assignment_history" ("equipment_id","assigned_at");
CREATE INDEX IF NOT EXISTS "rms_equipment_assignment_history_tenant_idx" ON "rms_equipment_assignment_history" ("tenant_id");

CREATE TABLE IF NOT EXISTS "rms_equipment_meter_readings" (
  "id" uuid PRIMARY KEY,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "equipment_id" uuid NOT NULL REFERENCES "rms_equipment"("id"),
  "meter_type" varchar(64) NOT NULL,
  "reading" double precision NOT NULL,
  "recorded_at" timestamptz NOT NULL,
  "source" varchar(64),
  "notes" text,
  "created_by_user_id" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "rms_equipment_meter_readings_equipment_idx" ON "rms_equipment_meter_readings" ("equipment_id","recorded_at");
CREATE INDEX IF NOT EXISTS "rms_equipment_meter_readings_tenant_idx" ON "rms_equipment_meter_readings" ("tenant_id");

CREATE TABLE IF NOT EXISTS "rms_inventory_items" (
  "id" uuid PRIMARY KEY,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "item_code" varchar(64) NOT NULL,
  "name" varchar(200) NOT NULL,
  "category" varchar(120),
  "unit_of_measure" varchar(32) NOT NULL DEFAULT 'EA',
  "storage_location" varchar(200) NOT NULL DEFAULT 'GENERAL',
  "station_id" uuid REFERENCES "rms_stations"("id"),
  "apparatus_id" uuid REFERENCES "rms_apparatus"("id"),
  "current_quantity" double precision NOT NULL DEFAULT 0,
  "minimum_quantity" double precision,
  "target_quantity" double precision,
  "status" varchar(32) NOT NULL DEFAULT 'ACTIVE',
  "expiration_tracked" boolean NOT NULL DEFAULT false,
  "lot_tracked" boolean NOT NULL DEFAULT false,
  "notes" text,
  "record_version" integer NOT NULL DEFAULT 1,
  "created_by_user_id" uuid,
  "updated_by_user_id" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "deleted_by_user_id" uuid
);
CREATE UNIQUE INDEX IF NOT EXISTS "rms_inventory_items_tenant_code_location_uidx" ON "rms_inventory_items" ("tenant_id","item_code","storage_location");
CREATE INDEX IF NOT EXISTS "rms_inventory_items_tenant_status_idx" ON "rms_inventory_items" ("tenant_id","status");
CREATE INDEX IF NOT EXISTS "rms_inventory_items_station_idx" ON "rms_inventory_items" ("station_id");
CREATE INDEX IF NOT EXISTS "rms_inventory_items_apparatus_idx" ON "rms_inventory_items" ("apparatus_id");

CREATE TABLE IF NOT EXISTS "rms_inventory_transactions" (
  "id" uuid PRIMARY KEY,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "inventory_item_id" uuid NOT NULL REFERENCES "rms_inventory_items"("id"),
  "transaction_type" varchar(32) NOT NULL,
  "quantity_delta" double precision NOT NULL,
  "quantity_after" double precision NOT NULL,
  "reference_type" varchar(64),
  "reference_id" varchar(120),
  "lot_number" varchar(120),
  "expiration_date" date,
  "reason" text,
  "occurred_at" timestamptz NOT NULL,
  "performed_by_personnel_id" uuid REFERENCES "rms_personnel"("id"),
  "created_by_user_id" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "rms_inventory_transactions_item_date_idx" ON "rms_inventory_transactions" ("inventory_item_id","occurred_at");
CREATE INDEX IF NOT EXISTS "rms_inventory_transactions_tenant_idx" ON "rms_inventory_transactions" ("tenant_id");

GRANT SELECT, INSERT, UPDATE, DELETE ON
  "rms_equipment",
  "rms_equipment_assignment_history",
  "rms_equipment_meter_readings",
  "rms_inventory_items",
  "rms_inventory_transactions"
TO forge_app;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'rms_equipment',
    'rms_equipment_assignment_history',
    'rms_equipment_meter_readings',
    'rms_inventory_items',
    'rms_inventory_transactions'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_tenant_isolation', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING (tenant_id = nullif(current_setting(''app.current_tenant_id'', true), '''')::uuid) WITH CHECK (tenant_id = nullif(current_setting(''app.current_tenant_id'', true), '''')::uuid)',
      t || '_tenant_isolation', t
    );
  END LOOP;
END
$$;
