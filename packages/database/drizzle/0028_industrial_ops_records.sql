-- Industrial Operations thin slice (IND-3 list/create store)
-- Additive only. FORCE RLS preserved.

CREATE TABLE IF NOT EXISTS "industrial_ops_records" (
  "id" uuid PRIMARY KEY,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "module" varchar(64) NOT NULL,
  "title" varchar(500) NOT NULL,
  "status" varchar(64) NOT NULL DEFAULT 'ACTIVE',
  "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "record_version" integer NOT NULL DEFAULT 1,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "archived_at" timestamptz
);

CREATE INDEX IF NOT EXISTS "industrial_ops_records_tenant_module_idx"
  ON "industrial_ops_records" ("tenant_id", "module");

CREATE INDEX IF NOT EXISTS "industrial_ops_records_tenant_status_idx"
  ON "industrial_ops_records" ("tenant_id", "status");

CREATE UNIQUE INDEX IF NOT EXISTS "industrial_ops_records_tenant_id_uidx"
  ON "industrial_ops_records" ("tenant_id", "id");

ALTER TABLE "industrial_ops_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "industrial_ops_records" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "industrial_ops_records_tenant_isolation" ON "industrial_ops_records";
CREATE POLICY "industrial_ops_records_tenant_isolation" ON "industrial_ops_records"
  USING (tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'forge_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "industrial_ops_records" TO forge_app;
  END IF;
END $$;
