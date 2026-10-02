CREATE TABLE IF NOT EXISTS "rms_investigation_cases" (
  "id" uuid PRIMARY KEY,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "case_number" varchar(64) NOT NULL,
  "incident_id" uuid REFERENCES "neris_incidents"("id"),
  "occupancy_id" uuid REFERENCES "rms_occupancies"("id"),
  "case_type" varchar(64) NOT NULL DEFAULT 'FIRE_INVESTIGATION',
  "lead_investigator" varchar(200),
  "status" varchar(48) NOT NULL DEFAULT 'OPEN',
  "opened_at" timestamptz NOT NULL,
  "closed_at" timestamptz,
  "location" text,
  "scene_status" varchar(32),
  "weather" varchar(200),
  "initial_observations" text,
  "area_of_origin" text,
  "cause_classification" varchar(64),
  "cause_narrative" text,
  "disposition" varchar(120),
  "supervisor_review_status" varchar(32) NOT NULL DEFAULT 'NOT_SUBMITTED',
  "supervisor_reviewer" varchar(200),
  "supervisor_reviewed_at" timestamptz,
  "supervisor_notes" text,
  "record_version" integer NOT NULL DEFAULT 1,
  "created_by_user_id" uuid,
  "updated_by_user_id" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "deleted_by_user_id" uuid
);
CREATE UNIQUE INDEX IF NOT EXISTS "rms_investigation_cases_tenant_number_uidx" ON "rms_investigation_cases" ("tenant_id","case_number");
CREATE INDEX IF NOT EXISTS "rms_investigation_cases_tenant_status_idx" ON "rms_investigation_cases" ("tenant_id","status");
CREATE INDEX IF NOT EXISTS "rms_investigation_cases_incident_idx" ON "rms_investigation_cases" ("incident_id");
CREATE INDEX IF NOT EXISTS "rms_investigation_cases_occupancy_idx" ON "rms_investigation_cases" ("occupancy_id");

CREATE TABLE IF NOT EXISTS "rms_investigation_evidence" (
  "id" uuid PRIMARY KEY,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "case_id" uuid NOT NULL REFERENCES "rms_investigation_cases"("id"),
  "evidence_type" varchar(48) NOT NULL,
  "tag_number" varchar(80) NOT NULL,
  "title" varchar(300),
  "description" text,
  "collected_at" timestamptz,
  "collected_by" varchar(200),
  "current_custodian" varchar(200),
  "storage_location" varchar(300),
  "status" varchar(32) NOT NULL DEFAULT 'IN_CUSTODY',
  "notes" text,
  "record_version" integer NOT NULL DEFAULT 1,
  "created_by_user_id" uuid,
  "updated_by_user_id" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "rms_investigation_evidence_case_tag_uidx" ON "rms_investigation_evidence" ("tenant_id","case_id","tag_number");
CREATE INDEX IF NOT EXISTS "rms_investigation_evidence_case_idx" ON "rms_investigation_evidence" ("case_id");

CREATE TABLE IF NOT EXISTS "rms_investigation_custody_events" (
  "id" uuid PRIMARY KEY,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "evidence_id" uuid NOT NULL REFERENCES "rms_investigation_evidence"("id"),
  "action" varchar(48) NOT NULL,
  "occurred_at" timestamptz NOT NULL,
  "from_custodian" varchar(200),
  "to_custodian" varchar(200),
  "location" varchar(300),
  "notes" text,
  "created_by_user_id" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "rms_investigation_custody_evidence_time_idx" ON "rms_investigation_custody_events" ("evidence_id","occurred_at");
CREATE INDEX IF NOT EXISTS "rms_investigation_custody_tenant_idx" ON "rms_investigation_custody_events" ("tenant_id");

GRANT SELECT, INSERT, UPDATE, DELETE ON "rms_investigation_cases","rms_investigation_evidence","rms_investigation_custody_events" TO forge_app;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['rms_investigation_cases','rms_investigation_evidence','rms_investigation_custody_events']
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
