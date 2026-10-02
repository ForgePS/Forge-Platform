CREATE TABLE IF NOT EXISTS "rms_inventory_items" (
  "id" uuid PRIMARY KEY,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "item_code" varchar(80) NOT NULL,
  "name" varchar(240) NOT NULL,
  "category" varchar(80) NOT NULL DEFAULT 'GENERAL',
  "description" text,
  "unit_of_measure" varchar(40) NOT NULL DEFAULT 'EA',
  "minimum_quantity" double precision,
  "reorder_quantity" double precision,
  "tracking_mode" varchar(32) NOT NULL DEFAULT 'QUANTITY',
  "status" varchar(32) NOT NULL DEFAULT 'ACTIVE',
  "record_version" integer NOT NULL DEFAULT 1,
  "created_by_user_id" uuid,
  "updated_by_user_id" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "deleted_by_user_id" uuid
);
CREATE UNIQUE INDEX IF NOT EXISTS "rms_inventory_items_tenant_code_uidx" ON "rms_inventory_items" ("tenant_id","item_code");
CREATE INDEX IF NOT EXISTS "rms_inventory_items_tenant_status_idx" ON "rms_inventory_items" ("tenant_id","status");
CREATE INDEX IF NOT EXISTS "rms_inventory_items_category_idx" ON "rms_inventory_items" ("tenant_id","category");

CREATE TABLE IF NOT EXISTS "rms_inventory_locations" (
  "id" uuid PRIMARY KEY,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "location_code" varchar(80) NOT NULL,
  "name" varchar(240) NOT NULL,
  "location_type" varchar(48) NOT NULL DEFAULT 'WAREHOUSE',
  "station_id" uuid REFERENCES "rms_stations"("id"),
  "apparatus_id" uuid REFERENCES "rms_apparatus"("id"),
  "personnel_id" uuid REFERENCES "rms_personnel"("id"),
  "status" varchar(32) NOT NULL DEFAULT 'ACTIVE',
  "notes" text,
  "record_version" integer NOT NULL DEFAULT 1,
  "created_by_user_id" uuid,
  "updated_by_user_id" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "deleted_by_user_id" uuid
);
CREATE UNIQUE INDEX IF NOT EXISTS "rms_inventory_locations_tenant_code_uidx" ON "rms_inventory_locations" ("tenant_id","location_code");
CREATE INDEX IF NOT EXISTS "rms_inventory_locations_type_idx" ON "rms_inventory_locations" ("tenant_id","location_type");

CREATE TABLE IF NOT EXISTS "rms_inventory_balances" (
  "id" uuid PRIMARY KEY,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "item_id" uuid NOT NULL REFERENCES "rms_inventory_items"("id"),
  "location_id" uuid NOT NULL REFERENCES "rms_inventory_locations"("id"),
  "quantity" double precision NOT NULL DEFAULT 0,
  "record_version" integer NOT NULL DEFAULT 1,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "rms_inventory_balances_item_location_uidx" ON "rms_inventory_balances" ("tenant_id","item_id","location_id");
CREATE INDEX IF NOT EXISTS "rms_inventory_balances_location_idx" ON "rms_inventory_balances" ("tenant_id","location_id");
CREATE INDEX IF NOT EXISTS "rms_inventory_balances_item_idx" ON "rms_inventory_balances" ("tenant_id","item_id");

CREATE TABLE IF NOT EXISTS "rms_inventory_transactions" (
  "id" uuid PRIMARY KEY,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "item_id" uuid NOT NULL REFERENCES "rms_inventory_items"("id"),
  "transaction_type" varchar(48) NOT NULL,
  "quantity" double precision NOT NULL,
  "from_location_id" uuid REFERENCES "rms_inventory_locations"("id"),
  "to_location_id" uuid REFERENCES "rms_inventory_locations"("id"),
  "occurred_at" timestamptz NOT NULL,
  "lot_number" varchar(120),
  "expiration_date" date,
  "serial_number" varchar(160),
  "reference" varchar(240),
  "performed_by_personnel_id" uuid REFERENCES "rms_personnel"("id"),
  "notes" text,
  "created_by_user_id" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "rms_inventory_transactions_item_time_idx" ON "rms_inventory_transactions" ("tenant_id","item_id","occurred_at");
CREATE INDEX IF NOT EXISTS "rms_inventory_transactions_from_idx" ON "rms_inventory_transactions" ("tenant_id","from_location_id","occurred_at");
CREATE INDEX IF NOT EXISTS "rms_inventory_transactions_to_idx" ON "rms_inventory_transactions" ("tenant_id","to_location_id","occurred_at");

GRANT SELECT, INSERT, UPDATE, DELETE ON "rms_inventory_items","rms_inventory_locations","rms_inventory_balances","rms_inventory_transactions" TO forge_app;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['rms_inventory_items','rms_inventory_locations','rms_inventory_balances','rms_inventory_transactions']
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
