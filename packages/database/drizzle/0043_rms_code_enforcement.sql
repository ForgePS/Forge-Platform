CREATE TABLE IF NOT EXISTS "rms_code_cases" (
  "id" uuid PRIMARY KEY,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "case_number" varchar(64) NOT NULL,
  "occupancy_id" uuid NOT NULL REFERENCES "rms_occupancies"("id"),
  "inspection_id" uuid REFERENCES "rms_inspections"("id"),
  "case_type" varchar(48) NOT NULL DEFAULT 'VIOLATION',
  "status" varchar(48) NOT NULL DEFAULT 'OPEN',
  "opened_at" timestamptz NOT NULL,
  "compliance_due_date" date,
  "closed_at" timestamptz,
  "responsible_party" varchar(200),
  "contact_email" varchar(320),
  "contact_phone" varchar(64),
  "summary" text,
  "notes" text,
  "record_version" integer NOT NULL DEFAULT 1,
  "created_by_user_id" uuid,
  "updated_by_user_id" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "deleted_by_user_id" uuid
);
CREATE UNIQUE INDEX IF NOT EXISTS "rms_code_cases_tenant_number_uidx" ON "rms_code_cases" ("tenant_id","case_number");
CREATE INDEX IF NOT EXISTS "rms_code_cases_tenant_status_idx" ON "rms_code_cases" ("tenant_id","status");
CREATE INDEX IF NOT EXISTS "rms_code_cases_occupancy_idx" ON "rms_code_cases" ("occupancy_id");
CREATE INDEX IF NOT EXISTS "rms_code_cases_due_idx" ON "rms_code_cases" ("tenant_id","compliance_due_date");

CREATE TABLE IF NOT EXISTS "rms_code_violations" (
  "id" uuid PRIMARY KEY,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "case_id" uuid NOT NULL REFERENCES "rms_code_cases"("id"),
  "inspection_finding_id" uuid REFERENCES "rms_inspection_findings"("id"),
  "code_reference" varchar(160),
  "title" varchar(300) NOT NULL,
  "description" text,
  "severity" varchar(32) NOT NULL DEFAULT 'MODERATE',
  "status" varchar(32) NOT NULL DEFAULT 'OPEN',
  "corrective_action" text,
  "correction_due_date" date,
  "corrected_at" timestamptz,
  "verified_at" timestamptz,
  "verification_notes" text,
  "fine_amount" double precision,
  "record_version" integer NOT NULL DEFAULT 1,
  "created_by_user_id" uuid,
  "updated_by_user_id" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "rms_code_violations_case_idx" ON "rms_code_violations" ("case_id");
CREATE INDEX IF NOT EXISTS "rms_code_violations_tenant_status_due_idx" ON "rms_code_violations" ("tenant_id","status","correction_due_date");
CREATE INDEX IF NOT EXISTS "rms_code_violations_finding_idx" ON "rms_code_violations" ("inspection_finding_id");

CREATE TABLE IF NOT EXISTS "rms_code_notices" (
  "id" uuid PRIMARY KEY,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "case_id" uuid NOT NULL REFERENCES "rms_code_cases"("id"),
  "notice_type" varchar(64) NOT NULL DEFAULT 'NOTICE_OF_VIOLATION',
  "issued_at" timestamptz NOT NULL,
  "recipient" varchar(300),
  "delivery_method" varchar(64),
  "served_at" timestamptz,
  "subject" varchar(300),
  "body_snapshot" text NOT NULL,
  "created_by_user_id" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "rms_code_notices_case_idx" ON "rms_code_notices" ("case_id");
CREATE INDEX IF NOT EXISTS "rms_code_notices_tenant_issued_idx" ON "rms_code_notices" ("tenant_id","issued_at");

GRANT SELECT, INSERT, UPDATE, DELETE ON "rms_code_cases","rms_code_violations","rms_code_notices" TO forge_app;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['rms_code_cases','rms_code_violations','rms_code_notices']
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
