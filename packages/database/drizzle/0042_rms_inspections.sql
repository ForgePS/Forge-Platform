CREATE TABLE IF NOT EXISTS "rms_inspection_programs" (
  "id" uuid PRIMARY KEY,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "name" varchar(200) NOT NULL,
  "code" varchar(64),
  "description" text,
  "active" boolean NOT NULL DEFAULT true,
  "frequency" varchar(80),
  "record_version" integer NOT NULL DEFAULT 1,
  "created_by_user_id" uuid,
  "updated_by_user_id" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "deleted_by_user_id" uuid
);
CREATE UNIQUE INDEX IF NOT EXISTS "rms_inspection_programs_tenant_name_uidx" ON "rms_inspection_programs" ("tenant_id","name");
CREATE INDEX IF NOT EXISTS "rms_inspection_programs_tenant_active_idx" ON "rms_inspection_programs" ("tenant_id","active");

CREATE TABLE IF NOT EXISTS "rms_inspection_templates" (
  "id" uuid PRIMARY KEY,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "program_id" uuid REFERENCES "rms_inspection_programs"("id"),
  "name" varchar(200) NOT NULL,
  "lifecycle_status" varchar(32) NOT NULL DEFAULT 'DRAFT',
  "version" integer NOT NULL DEFAULT 1,
  "sections_json" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "published_at" timestamptz,
  "record_version" integer NOT NULL DEFAULT 1,
  "created_by_user_id" uuid,
  "updated_by_user_id" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "deleted_by_user_id" uuid
);
CREATE INDEX IF NOT EXISTS "rms_inspection_templates_program_idx" ON "rms_inspection_templates" ("program_id");
CREATE INDEX IF NOT EXISTS "rms_inspection_templates_tenant_status_idx" ON "rms_inspection_templates" ("tenant_id","lifecycle_status");

CREATE TABLE IF NOT EXISTS "rms_inspections" (
  "id" uuid PRIMARY KEY,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "occupancy_id" uuid NOT NULL REFERENCES "rms_occupancies"("id"),
  "program_id" uuid REFERENCES "rms_inspection_programs"("id"),
  "template_id" uuid REFERENCES "rms_inspection_templates"("id"),
  "inspector_name" varchar(200),
  "inspection_date" date NOT NULL,
  "scheduled_date" date,
  "started_at" timestamptz,
  "completed_at" timestamptz,
  "status" varchar(32) NOT NULL DEFAULT 'SCHEDULED',
  "overall_result" varchar(32) NOT NULL DEFAULT 'PENDING',
  "follow_up_date" date,
  "notes" text,
  "checklist_snapshot_json" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "record_version" integer NOT NULL DEFAULT 1,
  "created_by_user_id" uuid,
  "updated_by_user_id" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "deleted_by_user_id" uuid
);
CREATE INDEX IF NOT EXISTS "rms_inspections_tenant_status_idx" ON "rms_inspections" ("tenant_id","status");
CREATE INDEX IF NOT EXISTS "rms_inspections_occupancy_date_idx" ON "rms_inspections" ("occupancy_id","inspection_date");
CREATE INDEX IF NOT EXISTS "rms_inspections_followup_idx" ON "rms_inspections" ("tenant_id","follow_up_date");

CREATE TABLE IF NOT EXISTS "rms_inspection_responses" (
  "id" uuid PRIMARY KEY,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "inspection_id" uuid NOT NULL REFERENCES "rms_inspections"("id"),
  "section_id" varchar(120),
  "field_key" varchar(160) NOT NULL,
  "field_label" varchar(300),
  "result" varchar(32),
  "value_json" jsonb,
  "comment" text,
  "record_version" integer NOT NULL DEFAULT 1,
  "created_by_user_id" uuid,
  "updated_by_user_id" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "rms_inspection_responses_field_uidx" ON "rms_inspection_responses" ("tenant_id","inspection_id","field_key");
CREATE INDEX IF NOT EXISTS "rms_inspection_responses_inspection_idx" ON "rms_inspection_responses" ("inspection_id");

CREATE TABLE IF NOT EXISTS "rms_inspection_findings" (
  "id" uuid PRIMARY KEY,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "inspection_id" uuid NOT NULL REFERENCES "rms_inspections"("id"),
  "response_id" uuid REFERENCES "rms_inspection_responses"("id"),
  "title" varchar(300) NOT NULL,
  "description" text,
  "severity" varchar(32) NOT NULL DEFAULT 'MODERATE',
  "corrective_action" text,
  "responsible_party" varchar(200),
  "due_date" date,
  "status" varchar(32) NOT NULL DEFAULT 'OPEN',
  "corrected_at" timestamptz,
  "verified_at" timestamptz,
  "verification_notes" text,
  "record_version" integer NOT NULL DEFAULT 1,
  "created_by_user_id" uuid,
  "updated_by_user_id" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "rms_inspection_findings_inspection_idx" ON "rms_inspection_findings" ("inspection_id");
CREATE INDEX IF NOT EXISTS "rms_inspection_findings_tenant_status_due_idx" ON "rms_inspection_findings" ("tenant_id","status","due_date");

GRANT SELECT, INSERT, UPDATE, DELETE ON "rms_inspection_programs","rms_inspection_templates","rms_inspections","rms_inspection_responses","rms_inspection_findings" TO forge_app;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['rms_inspection_programs','rms_inspection_templates','rms_inspections','rms_inspection_responses','rms_inspection_findings']
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
