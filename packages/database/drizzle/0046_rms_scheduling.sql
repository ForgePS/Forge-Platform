CREATE TABLE IF NOT EXISTS "rms_schedule_assignments" (
  "id" uuid PRIMARY KEY,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "personnel_id" uuid NOT NULL REFERENCES "rms_personnel"("id"),
  "shift_id" uuid REFERENCES "rms_shifts"("id"),
  "station_id" uuid REFERENCES "rms_stations"("id"),
  "unit_id" uuid REFERENCES "rms_units"("id"),
  "start_at" timestamptz NOT NULL,
  "end_at" timestamptz NOT NULL,
  "assignment_type" varchar(48) NOT NULL DEFAULT 'DUTY',
  "role" varchar(80),
  "status" varchar(32) NOT NULL DEFAULT 'SCHEDULED',
  "eligibility_status" varchar(32) NOT NULL DEFAULT 'UNKNOWN',
  "eligibility_warnings_json" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "notes" text,
  "record_version" integer NOT NULL DEFAULT 1,
  "created_by_user_id" uuid,
  "updated_by_user_id" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  "deleted_by_user_id" uuid
);
CREATE INDEX IF NOT EXISTS "rms_schedule_assignments_personnel_time_idx" ON "rms_schedule_assignments" ("tenant_id","personnel_id","start_at","end_at");
CREATE INDEX IF NOT EXISTS "rms_schedule_assignments_station_time_idx" ON "rms_schedule_assignments" ("tenant_id","station_id","start_at");
CREATE INDEX IF NOT EXISTS "rms_schedule_assignments_unit_time_idx" ON "rms_schedule_assignments" ("tenant_id","unit_id","start_at");

CREATE TABLE IF NOT EXISTS "rms_time_off_requests" (
  "id" uuid PRIMARY KEY,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "personnel_id" uuid NOT NULL REFERENCES "rms_personnel"("id"),
  "start_at" timestamptz NOT NULL,
  "end_at" timestamptz NOT NULL,
  "leave_type" varchar(48) NOT NULL DEFAULT 'VACATION',
  "status" varchar(32) NOT NULL DEFAULT 'PENDING',
  "reason" text,
  "reviewer" varchar(200),
  "reviewed_at" timestamptz,
  "review_notes" text,
  "record_version" integer NOT NULL DEFAULT 1,
  "created_by_user_id" uuid,
  "updated_by_user_id" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "rms_time_off_personnel_time_idx" ON "rms_time_off_requests" ("tenant_id","personnel_id","start_at","end_at");
CREATE INDEX IF NOT EXISTS "rms_time_off_status_idx" ON "rms_time_off_requests" ("tenant_id","status","start_at");

CREATE TABLE IF NOT EXISTS "rms_shift_swap_requests" (
  "id" uuid PRIMARY KEY,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "offered_assignment_id" uuid NOT NULL REFERENCES "rms_schedule_assignments"("id"),
  "requester_personnel_id" uuid NOT NULL REFERENCES "rms_personnel"("id"),
  "replacement_personnel_id" uuid REFERENCES "rms_personnel"("id"),
  "target_personnel_id" uuid REFERENCES "rms_personnel"("id"),
  "status" varchar(32) NOT NULL DEFAULT 'PENDING',
  "reason" text,
  "reviewer" varchar(200),
  "reviewed_at" timestamptz,
  "review_notes" text,
  "record_version" integer NOT NULL DEFAULT 1,
  "created_by_user_id" uuid,
  "updated_by_user_id" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "rms_shift_swap_status_idx" ON "rms_shift_swap_requests" ("tenant_id","status","created_at");
CREATE INDEX IF NOT EXISTS "rms_shift_swap_requester_idx" ON "rms_shift_swap_requests" ("tenant_id","requester_personnel_id");
CREATE INDEX IF NOT EXISTS "rms_shift_swap_assignment_idx" ON "rms_shift_swap_requests" ("offered_assignment_id");

GRANT SELECT, INSERT, UPDATE, DELETE ON "rms_schedule_assignments","rms_time_off_requests","rms_shift_swap_requests" TO forge_app;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['rms_schedule_assignments','rms_time_off_requests','rms_shift_swap_requests']
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
