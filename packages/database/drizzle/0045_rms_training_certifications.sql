CREATE TABLE IF NOT EXISTS "rms_training_courses" (
  "id" uuid PRIMARY KEY,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "code" varchar(64) NOT NULL,
  "title" varchar(240) NOT NULL,
  "category" varchar(80) NOT NULL DEFAULT 'GENERAL',
  "description" text,
  "delivery_mode" varchar(48) NOT NULL DEFAULT 'IN_PERSON',
  "default_hours" double precision,
  "recurrence_months" integer,
  "required_for_incident_eligibility" boolean NOT NULL DEFAULT false,
  "status" varchar(32) NOT NULL DEFAULT 'ACTIVE',
  "record_version" integer NOT NULL DEFAULT 1,
  "created_by_user_id" uuid,
  "updated_by_user_id" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "deleted_by_user_id" uuid
);
CREATE UNIQUE INDEX IF NOT EXISTS "rms_training_courses_tenant_code_uidx" ON "rms_training_courses" ("tenant_id","code");
CREATE INDEX IF NOT EXISTS "rms_training_courses_tenant_status_idx" ON "rms_training_courses" ("tenant_id","status");
CREATE INDEX IF NOT EXISTS "rms_training_courses_category_idx" ON "rms_training_courses" ("tenant_id","category");

CREATE TABLE IF NOT EXISTS "rms_training_records" (
  "id" uuid PRIMARY KEY,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "course_id" uuid NOT NULL REFERENCES "rms_training_courses"("id"),
  "personnel_id" uuid NOT NULL REFERENCES "rms_personnel"("id"),
  "completed_at" timestamptz NOT NULL,
  "expires_at" timestamptz,
  "hours" double precision,
  "status" varchar(32) NOT NULL DEFAULT 'COMPLETED',
  "instructor" varchar(200),
  "location" varchar(300),
  "score" double precision,
  "certificate_number" varchar(160),
  "notes" text,
  "source" varchar(64) NOT NULL DEFAULT 'MANUAL',
  "record_version" integer NOT NULL DEFAULT 1,
  "created_by_user_id" uuid,
  "updated_by_user_id" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "rms_training_records_personnel_idx" ON "rms_training_records" ("tenant_id","personnel_id","completed_at");
CREATE INDEX IF NOT EXISTS "rms_training_records_course_idx" ON "rms_training_records" ("tenant_id","course_id","completed_at");
CREATE INDEX IF NOT EXISTS "rms_training_records_expiry_idx" ON "rms_training_records" ("tenant_id","expires_at");

CREATE TABLE IF NOT EXISTS "rms_certification_types" (
  "id" uuid PRIMARY KEY,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "code" varchar(64) NOT NULL,
  "name" varchar(240) NOT NULL,
  "issuing_authority" varchar(240),
  "category" varchar(80) NOT NULL DEFAULT 'GENERAL',
  "default_validity_months" integer,
  "required_for_incident_eligibility" boolean NOT NULL DEFAULT false,
  "status" varchar(32) NOT NULL DEFAULT 'ACTIVE',
  "record_version" integer NOT NULL DEFAULT 1,
  "created_by_user_id" uuid,
  "updated_by_user_id" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "deleted_by_user_id" uuid
);
CREATE UNIQUE INDEX IF NOT EXISTS "rms_certification_types_tenant_code_uidx" ON "rms_certification_types" ("tenant_id","code");
CREATE INDEX IF NOT EXISTS "rms_certification_types_tenant_status_idx" ON "rms_certification_types" ("tenant_id","status");

CREATE TABLE IF NOT EXISTS "rms_personnel_certifications" (
  "id" uuid PRIMARY KEY,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "personnel_id" uuid NOT NULL REFERENCES "rms_personnel"("id"),
  "certification_type_id" uuid NOT NULL REFERENCES "rms_certification_types"("id"),
  "credential_number" varchar(160),
  "issued_at" date,
  "expires_at" date,
  "status" varchar(32) NOT NULL DEFAULT 'ACTIVE',
  "verified_at" timestamptz,
  "verified_by" varchar(200),
  "notes" text,
  "record_version" integer NOT NULL DEFAULT 1,
  "created_by_user_id" uuid,
  "updated_by_user_id" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "rms_personnel_certifications_personnel_idx" ON "rms_personnel_certifications" ("tenant_id","personnel_id","status");
CREATE INDEX IF NOT EXISTS "rms_personnel_certifications_type_idx" ON "rms_personnel_certifications" ("tenant_id","certification_type_id");
CREATE INDEX IF NOT EXISTS "rms_personnel_certifications_expiry_idx" ON "rms_personnel_certifications" ("tenant_id","expires_at");

GRANT SELECT, INSERT, UPDATE, DELETE ON "rms_training_courses","rms_training_records","rms_certification_types","rms_personnel_certifications" TO forge_app;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['rms_training_courses','rms_training_records','rms_certification_types','rms_personnel_certifications']
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
