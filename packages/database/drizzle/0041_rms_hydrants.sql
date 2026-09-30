CREATE TABLE IF NOT EXISTS "rms_hydrants" (
  "id" uuid PRIMARY KEY,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "display_id" varchar(64) NOT NULL,
  "address_line1" varchar(300),
  "city" varchar(120),
  "state" varchar(64),
  "postal_code" varchar(32),
  "latitude" double precision,
  "longitude" double precision,
  "status" varchar(32) NOT NULL DEFAULT 'IN_SERVICE',
  "water_provider" varchar(200),
  "hydrant_type" varchar(80),
  "manufacturer" varchar(120),
  "model" varchar(120),
  "install_date" date,
  "last_inspection_date" date,
  "last_flow_test_date" date,
  "flow_gpm" double precision,
  "static_psi" double precision,
  "residual_psi" double precision,
  "nfpa_class" varchar(16),
  "nfpa_color" varchar(64),
  "notes" text,
  "record_version" integer NOT NULL DEFAULT 1,
  "created_by_user_id" uuid,
  "updated_by_user_id" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "deleted_by_user_id" uuid
);
CREATE UNIQUE INDEX IF NOT EXISTS "rms_hydrants_tenant_display_id_uidx" ON "rms_hydrants" ("tenant_id","display_id");
CREATE INDEX IF NOT EXISTS "rms_hydrants_tenant_status_idx" ON "rms_hydrants" ("tenant_id","status");
CREATE INDEX IF NOT EXISTS "rms_hydrants_tenant_coordinates_idx" ON "rms_hydrants" ("tenant_id","latitude","longitude");

CREATE TABLE IF NOT EXISTS "rms_hydrant_flow_tests" (
  "id" uuid PRIMARY KEY,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "hydrant_id" uuid NOT NULL REFERENCES "rms_hydrants"("id"),
  "test_date" date NOT NULL,
  "static_psi" double precision,
  "residual_psi" double precision,
  "flow_gpm" double precision NOT NULL,
  "nfpa_class" varchar(16),
  "nfpa_color" varchar(64),
  "tested_by" varchar(200),
  "notes" text,
  "created_by_user_id" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "rms_hydrant_flow_tests_hydrant_date_idx" ON "rms_hydrant_flow_tests" ("hydrant_id","test_date");
CREATE INDEX IF NOT EXISTS "rms_hydrant_flow_tests_tenant_idx" ON "rms_hydrant_flow_tests" ("tenant_id");

GRANT SELECT, INSERT, UPDATE, DELETE ON "rms_hydrants", "rms_hydrant_flow_tests" TO forge_app;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['rms_hydrants','rms_hydrant_flow_tests']
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
