-- Subscription-S1 commercial foundation
-- Additive: ALTER subscriptions + CREATE commercial tables, RLS, seed sequences/plans.

-- ---------------------------------------------------------------------------
-- Extend subscriptions with commercial columns
-- ---------------------------------------------------------------------------
ALTER TABLE "subscriptions"
  ADD COLUMN IF NOT EXISTS "subscription_number" varchar(64),
  ADD COLUMN IF NOT EXISTS "commercial_status" varchar(32) NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS "currency" varchar(3) NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS "billing_frequency" varchar(32) NOT NULL DEFAULT 'ANNUAL',
  ADD COLUMN IF NOT EXISTS "auto_renew" boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "contract_start_date" timestamptz,
  ADD COLUMN IF NOT EXISTS "renewal_date" timestamptz,
  ADD COLUMN IF NOT EXISTS "billing_contact_name" varchar(200),
  ADD COLUMN IF NOT EXISTS "billing_contact_email" varchar(320),
  ADD COLUMN IF NOT EXISTS "account_owner_user_id" uuid REFERENCES "users"("id"),
  ADD COLUMN IF NOT EXISTS "notes" text,
  ADD COLUMN IF NOT EXISTS "catalog_price_cents" integer,
  ADD COLUMN IF NOT EXISTS "effective_price_cents" integer,
  ADD COLUMN IF NOT EXISTS "implementation_fee_cents" integer,
  ADD COLUMN IF NOT EXISTS "discount_cents" integer,
  ADD COLUMN IF NOT EXISTS "tax_exempt" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "tax_notes" text,
  ADD COLUMN IF NOT EXISTS "payment_terms" varchar(64) NOT NULL DEFAULT 'NET_30',
  ADD COLUMN IF NOT EXISTS "access_policy" varchar(32) NOT NULL DEFAULT 'FULL_ACCESS';

CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_subscription_number_uidx"
  ON "subscriptions" ("subscription_number")
  WHERE "subscription_number" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "subscriptions_tenant_commercial_status_idx"
  ON "subscriptions" ("tenant_id", "commercial_status");

CREATE INDEX IF NOT EXISTS "subscriptions_tenant_renewal_date_idx"
  ON "subscriptions" ("tenant_id", "renewal_date");

-- ---------------------------------------------------------------------------
-- Platform-global plan versions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "subscription_plan_versions" (
  "id" uuid PRIMARY KEY NOT NULL,
  "plan_id" uuid NOT NULL REFERENCES "subscription_plans"("id"),
  "version_number" integer NOT NULL,
  "name" varchar(200) NOT NULL,
  "billing_frequency" varchar(32) NOT NULL,
  "base_price_cents" integer NOT NULL,
  "implementation_fee_cents" integer NOT NULL DEFAULT 0,
  "currency" varchar(3) NOT NULL DEFAULT 'USD',
  "configuration_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "status" varchar(32) NOT NULL DEFAULT 'DRAFT',
  "effective_from" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "subscription_plan_versions_plan_version_uidx"
  ON "subscription_plan_versions" ("plan_id", "version_number");

CREATE INDEX IF NOT EXISTS "subscription_plan_versions_plan_status_idx"
  ON "subscription_plan_versions" ("plan_id", "status");

-- ---------------------------------------------------------------------------
-- Tenant commercial tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "subscription_items" (
  "id" uuid PRIMARY KEY NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "subscription_id" uuid NOT NULL REFERENCES "subscriptions"("id"),
  "item_type" varchar(32) NOT NULL,
  "product_code" varchar(64),
  "module_code" varchar(64),
  "plan_version_id" uuid REFERENCES "subscription_plan_versions"("id"),
  "description" varchar(500) NOT NULL,
  "quantity" integer NOT NULL DEFAULT 1,
  "unit_price_cents" integer NOT NULL DEFAULT 0,
  "amount_cents" integer NOT NULL DEFAULT 0,
  "billing_frequency" varchar(32) NOT NULL DEFAULT 'ANNUAL',
  "status" varchar(32) NOT NULL DEFAULT 'ACTIVE',
  "starts_at" timestamptz,
  "ends_at" timestamptz,
  "configuration_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "record_version" integer NOT NULL DEFAULT 1,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "subscription_items_tenant_subscription_idx"
  ON "subscription_items" ("tenant_id", "subscription_id");

CREATE TABLE IF NOT EXISTS "subscription_changes" (
  "id" uuid PRIMARY KEY NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "subscription_id" uuid NOT NULL REFERENCES "subscriptions"("id"),
  "change_type" varchar(64) NOT NULL,
  "summary" text NOT NULL,
  "before_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "after_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "effective_at" timestamptz NOT NULL,
  "actor_user_id" uuid REFERENCES "users"("id"),
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "subscription_changes_tenant_subscription_idx"
  ON "subscription_changes" ("tenant_id", "subscription_id", "created_at");

CREATE TABLE IF NOT EXISTS "invoices" (
  "id" uuid PRIMARY KEY NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "subscription_id" uuid REFERENCES "subscriptions"("id"),
  "invoice_number" varchar(64) NOT NULL,
  "status" varchar(32) NOT NULL DEFAULT 'DRAFT',
  "currency" varchar(3) NOT NULL DEFAULT 'USD',
  "issue_date" timestamptz NOT NULL,
  "due_date" timestamptz NOT NULL,
  "subtotal_cents" integer NOT NULL DEFAULT 0,
  "discount_cents" integer NOT NULL DEFAULT 0,
  "tax_cents" integer NOT NULL DEFAULT 0,
  "credit_cents" integer NOT NULL DEFAULT 0,
  "total_cents" integer NOT NULL DEFAULT 0,
  "amount_paid_cents" integer NOT NULL DEFAULT 0,
  "balance_cents" integer NOT NULL DEFAULT 0,
  "notes" text,
  "billing_provider" varchar(64) NOT NULL DEFAULT 'MANUAL',
  "external_invoice_id" varchar(255),
  "finalized_at" timestamptz,
  "voided_at" timestamptz,
  "record_version" integer NOT NULL DEFAULT 1,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "invoices_invoice_number_uidx"
  ON "invoices" ("invoice_number");

CREATE INDEX IF NOT EXISTS "invoices_tenant_status_idx"
  ON "invoices" ("tenant_id", "status");

CREATE INDEX IF NOT EXISTS "invoices_tenant_subscription_idx"
  ON "invoices" ("tenant_id", "subscription_id");

CREATE TABLE IF NOT EXISTS "invoice_line_items" (
  "id" uuid PRIMARY KEY NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "invoice_id" uuid NOT NULL REFERENCES "invoices"("id"),
  "line_type" varchar(64) NOT NULL,
  "description" varchar(500) NOT NULL,
  "quantity" integer NOT NULL DEFAULT 1,
  "unit_price_cents" integer NOT NULL DEFAULT 0,
  "amount_cents" integer NOT NULL DEFAULT 0,
  "period_start" timestamptz,
  "period_end" timestamptz,
  "product_code" varchar(64),
  "module_code" varchar(64),
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "invoice_line_items_tenant_invoice_idx"
  ON "invoice_line_items" ("tenant_id", "invoice_id");

CREATE TABLE IF NOT EXISTS "payments" (
  "id" uuid PRIMARY KEY NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "payment_number" varchar(64) NOT NULL,
  "payment_date" timestamptz NOT NULL,
  "amount_cents" integer NOT NULL,
  "currency" varchar(3) NOT NULL DEFAULT 'USD',
  "method" varchar(32) NOT NULL DEFAULT 'MANUAL',
  "reference" varchar(255),
  "notes" text,
  "recorded_by_user_id" uuid REFERENCES "users"("id"),
  "billing_provider" varchar(64) NOT NULL DEFAULT 'MANUAL',
  "external_payment_id" varchar(255),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "payments_payment_number_uidx"
  ON "payments" ("payment_number");

CREATE INDEX IF NOT EXISTS "payments_tenant_date_idx"
  ON "payments" ("tenant_id", "payment_date");

CREATE TABLE IF NOT EXISTS "payment_allocations" (
  "id" uuid PRIMARY KEY NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "payment_id" uuid NOT NULL REFERENCES "payments"("id"),
  "invoice_id" uuid NOT NULL REFERENCES "invoices"("id"),
  "amount_cents" integer NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "payment_allocations_tenant_payment_idx"
  ON "payment_allocations" ("tenant_id", "payment_id");

CREATE INDEX IF NOT EXISTS "payment_allocations_tenant_invoice_idx"
  ON "payment_allocations" ("tenant_id", "invoice_id");

CREATE TABLE IF NOT EXISTS "account_credits" (
  "id" uuid PRIMARY KEY NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "credit_number" varchar(64) NOT NULL,
  "reason" varchar(500) NOT NULL,
  "amount_cents" integer NOT NULL,
  "applied_cents" integer NOT NULL DEFAULT 0,
  "remaining_cents" integer NOT NULL,
  "expires_at" timestamptz,
  "status" varchar(32) NOT NULL DEFAULT 'AVAILABLE',
  "created_by_user_id" uuid REFERENCES "users"("id"),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "account_credits_credit_number_uidx"
  ON "account_credits" ("credit_number");

CREATE INDEX IF NOT EXISTS "account_credits_tenant_status_idx"
  ON "account_credits" ("tenant_id", "status");

CREATE TABLE IF NOT EXISTS "discount_definitions" (
  "id" uuid PRIMARY KEY NOT NULL,
  "tenant_id" uuid REFERENCES "tenants"("id"),
  "code" varchar(64) NOT NULL,
  "name" varchar(200) NOT NULL,
  "discount_type" varchar(32) NOT NULL,
  "percent_bps" integer,
  "amount_cents" integer,
  "stackable" boolean NOT NULL DEFAULT false,
  "starts_at" timestamptz,
  "ends_at" timestamptz,
  "status" varchar(32) NOT NULL DEFAULT 'ACTIVE',
  "configuration_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "discount_definitions_tenant_code_uidx"
  ON "discount_definitions" ("tenant_id", "code")
  WHERE "tenant_id" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "discount_definitions_platform_code_uidx"
  ON "discount_definitions" ("code")
  WHERE "tenant_id" IS NULL;

CREATE TABLE IF NOT EXISTS "subscription_discount_links" (
  "id" uuid PRIMARY KEY NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "subscription_id" uuid NOT NULL REFERENCES "subscriptions"("id"),
  "discount_id" uuid NOT NULL REFERENCES "discount_definitions"("id"),
  "reason" text,
  "authorized_by_user_id" uuid REFERENCES "users"("id"),
  "starts_at" timestamptz,
  "ends_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "subscription_discount_links_tenant_subscription_idx"
  ON "subscription_discount_links" ("tenant_id", "subscription_id");

CREATE TABLE IF NOT EXISTS "subscription_contracts" (
  "id" uuid PRIMARY KEY NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "subscription_id" uuid NOT NULL REFERENCES "subscriptions"("id"),
  "contract_number" varchar(64) NOT NULL,
  "contract_type" varchar(64) NOT NULL DEFAULT 'MSA',
  "status" varchar(32) NOT NULL DEFAULT 'DRAFT',
  "title" varchar(300) NOT NULL,
  "document_key" varchar(512),
  "effective_from" timestamptz,
  "effective_to" timestamptz,
  "notes" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "subscription_contracts_contract_number_uidx"
  ON "subscription_contracts" ("contract_number");

CREATE INDEX IF NOT EXISTS "subscription_contracts_tenant_subscription_idx"
  ON "subscription_contracts" ("tenant_id", "subscription_id");

-- ---------------------------------------------------------------------------
-- Platform-global commercial number sequences
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "commercial_sequences" (
  "id" uuid PRIMARY KEY NOT NULL,
  "sequence_key" varchar(32) NOT NULL,
  "last_value" bigint NOT NULL DEFAULT 0,
  "prefix" varchar(16) NOT NULL,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "commercial_sequences_key_uidx"
  ON "commercial_sequences" ("sequence_key");

INSERT INTO "commercial_sequences" ("id", "sequence_key", "last_value", "prefix", "updated_at")
SELECT gen_random_uuid(), v.sequence_key, 0, v.prefix, now()
FROM (
  VALUES
    ('INVOICE', 'INV'),
    ('PAYMENT', 'PAY'),
    ('SUBSCRIPTION', 'SUB'),
    ('CREDIT', 'CR'),
    ('CONTRACT', 'CTR')
) AS v(sequence_key, prefix)
WHERE NOT EXISTS (
  SELECT 1 FROM "commercial_sequences" cs WHERE cs.sequence_key = v.sequence_key
);

-- ---------------------------------------------------------------------------
-- Development catalog plans (idempotent)
-- ---------------------------------------------------------------------------
INSERT INTO "subscription_plans" (
  "id", "code", "name", "billing_interval", "status", "base_price_cents", "currency", "configuration_json", "created_at", "updated_at"
)
SELECT gen_random_uuid(), v.code, v.name, 'ANNUAL', 'ACTIVE', v.base_price_cents, 'USD', v.configuration_json::jsonb, now(), now()
FROM (
  VALUES
    (
      'IND_ANNUAL_STANDARD',
      'Industrial Annual Standard',
      1200000,
      '{"includedModules":["CORE"],"optionalModules":[],"limits":{}}'
    ),
    (
      'RMS_ANNUAL_STANDARD',
      'RMS Annual Standard',
      1500000,
      '{"includedModules":["CORE","NERIS"],"optionalModules":[],"limits":{}}'
    ),
    (
      'ACADEMY_ANNUAL_STANDARD',
      'Academy Annual Standard',
      900000,
      '{"includedModules":["CORE"],"optionalModules":[],"limits":{}}'
    )
) AS v(code, name, base_price_cents, configuration_json)
WHERE NOT EXISTS (
  SELECT 1 FROM "subscription_plans" sp WHERE sp.code = v.code
);

-- Seed version 1 for each standard plan when missing
INSERT INTO "subscription_plan_versions" (
  "id", "plan_id", "version_number", "name", "billing_frequency",
  "base_price_cents", "implementation_fee_cents", "currency",
  "configuration_json", "status", "effective_from", "created_at", "updated_at"
)
SELECT
  gen_random_uuid(),
  sp.id,
  1,
  sp.name || ' v1',
  'ANNUAL',
  COALESCE(sp.base_price_cents, 0),
  0,
  sp.currency,
  sp.configuration_json,
  'ACTIVE',
  now(),
  now(),
  now()
FROM "subscription_plans" sp
WHERE sp.code IN ('IND_ANNUAL_STANDARD', 'RMS_ANNUAL_STANDARD', 'ACADEMY_ANNUAL_STANDARD')
  AND NOT EXISTS (
    SELECT 1 FROM "subscription_plan_versions" spv
    WHERE spv.plan_id = sp.id AND spv.version_number = 1
  );

-- ---------------------------------------------------------------------------
-- Row level security (tenant tables)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'subscription_items',
    'subscription_changes',
    'invoices',
    'invoice_line_items',
    'payments',
    'payment_allocations',
    'account_credits',
    'subscription_discount_links',
    'subscription_contracts'
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

-- discount_definitions: platform (NULL) or tenant-scoped
ALTER TABLE "discount_definitions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "discount_definitions" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "discount_definitions_tenant_isolation" ON "discount_definitions";
CREATE POLICY "discount_definitions_tenant_isolation" ON "discount_definitions"
  USING (
    tenant_id IS NULL
    OR tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid
    OR current_setting('app.bypass_rls', true) = 'on'
  )
  WITH CHECK (
    tenant_id IS NULL
    OR tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid
    OR current_setting('app.bypass_rls', true) = 'on'
  );

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'forge_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
      "subscription_plan_versions",
      "subscription_items",
      "subscription_changes",
      "invoices",
      "invoice_line_items",
      "payments",
      "payment_allocations",
      "account_credits",
      "discount_definitions",
      "subscription_discount_links",
      "subscription_contracts",
      "commercial_sequences"
    TO forge_app;
  END IF;
END $$;
