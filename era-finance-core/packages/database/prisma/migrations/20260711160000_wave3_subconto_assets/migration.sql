-- Wave 3: subconto dimensions, fixed-asset lifecycle prep, intangible assets, fiscal year close protocol

-- Enums
DO $wave3_subconto_kind$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SubcontoKind') THEN
    CREATE TYPE "SubcontoKind" AS ENUM (
      'COUNTERPARTY',
      'PROJECT',
      'COST_CENTER',
      'ITEM',
      'EMPLOYEE',
      'CUSTOM'
    );
  END IF;
END
$wave3_subconto_kind$;

DO $wave3_fa_lifecycle$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FixedAssetLifecycleEventType') THEN
    CREATE TYPE "FixedAssetLifecycleEventType" AS ENUM (
      'ACQUISITION',
      'MODERNIZATION',
      'REVALUATION',
      'DISPOSAL'
    );
  END IF;
END
$wave3_fa_lifecycle$;

-- Fixed asset lifecycle fields
ALTER TABLE "fixed_assets" ADD COLUMN IF NOT EXISTS "fixed_asset_account_id" UUID;
ALTER TABLE "fixed_assets" ADD COLUMN IF NOT EXISTS "modernization_cost" DECIMAL(19,4) NOT NULL DEFAULT 0;
ALTER TABLE "fixed_assets" ADD COLUMN IF NOT EXISTS "revaluation_reserve" DECIMAL(19,4) NOT NULL DEFAULT 0;
ALTER TABLE "fixed_assets" ADD COLUMN IF NOT EXISTS "disposed_portion" DECIMAL(5,4) NOT NULL DEFAULT 0;
ALTER TABLE "fixed_assets" ADD COLUMN IF NOT EXISTS "disposal_date" DATE;

CREATE INDEX IF NOT EXISTS "fixed_assets_fixed_asset_account_id_idx" ON "fixed_assets"("fixed_asset_account_id");

DO $wave3_fa_account_fk$
BEGIN
  ALTER TABLE "fixed_assets"
    ADD CONSTRAINT "fixed_assets_fixed_asset_account_id_fkey"
    FOREIGN KEY ("fixed_asset_account_id") REFERENCES "accounts"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$wave3_fa_account_fk$;

-- Fixed asset lifecycle events
CREATE TABLE IF NOT EXISTS "fixed_asset_lifecycle_events" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "fixed_asset_id" UUID NOT NULL,
    "event_type" "FixedAssetLifecycleEventType" NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "portion" DECIMAL(5,4),
    "note" TEXT,
    "transaction_id" UUID,
    "payload_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fixed_asset_lifecycle_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "fixed_asset_lifecycle_events_organization_id_fixed_asset_id_idx"
  ON "fixed_asset_lifecycle_events"("organization_id", "fixed_asset_id");
CREATE INDEX IF NOT EXISTS "fixed_asset_lifecycle_events_fixed_asset_id_event_type_idx"
  ON "fixed_asset_lifecycle_events"("fixed_asset_id", "event_type");

DO $wave3_fa_lifecycle_org_fk$
BEGIN
  ALTER TABLE "fixed_asset_lifecycle_events"
    ADD CONSTRAINT "fixed_asset_lifecycle_events_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$wave3_fa_lifecycle_org_fk$;

DO $wave3_fa_lifecycle_asset_fk$
BEGIN
  ALTER TABLE "fixed_asset_lifecycle_events"
    ADD CONSTRAINT "fixed_asset_lifecycle_events_fixed_asset_id_fkey"
    FOREIGN KEY ("fixed_asset_id") REFERENCES "fixed_assets"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$wave3_fa_lifecycle_asset_fk$;

DO $wave3_fa_lifecycle_tx_fk$
BEGIN
  ALTER TABLE "fixed_asset_lifecycle_events"
    ADD CONSTRAINT "fixed_asset_lifecycle_events_transaction_id_fkey"
    FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$wave3_fa_lifecycle_tx_fk$;

-- Intangible assets
CREATE TABLE IF NOT EXISTS "intangible_assets" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "inventory_number" TEXT NOT NULL,
    "purchase_date" DATE NOT NULL,
    "purchase_price" DECIMAL(19,4) NOT NULL,
    "useful_life_months" INTEGER NOT NULL,
    "salvage_value" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "depreciation_method" "FixedAssetDepreciationMethod" NOT NULL DEFAULT 'STRAIGHT_LINE',
    "status" "FixedAssetStatus" NOT NULL DEFAULT 'ACTIVE',
    "booked_amortization" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by_user_id" UUID,
    "deleted_reason" TEXT,

    CONSTRAINT "intangible_assets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "intangible_assets_organization_id_inventory_number_key"
  ON "intangible_assets"("organization_id", "inventory_number");
CREATE INDEX IF NOT EXISTS "intangible_assets_organization_id_purchase_date_idx"
  ON "intangible_assets"("organization_id", "purchase_date");
CREATE INDEX IF NOT EXISTS "intangible_assets_org_deleted_at_idx"
  ON "intangible_assets"("organization_id", "deleted_at");

DO $wave3_intangible_org_fk$
BEGIN
  ALTER TABLE "intangible_assets"
    ADD CONSTRAINT "intangible_assets_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$wave3_intangible_org_fk$;

-- Intangible amortization months
CREATE TABLE IF NOT EXISTS "intangible_amortization_months" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "intangible_asset_id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "transaction_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by_user_id" UUID,
    "deleted_reason" TEXT,

    CONSTRAINT "intangible_amortization_months_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "intangible_amortization_months_intangible_asset_id_year_month_key"
  ON "intangible_amortization_months"("intangible_asset_id", "year", "month");
CREATE INDEX IF NOT EXISTS "intangible_amortization_months_organization_id_year_month_idx"
  ON "intangible_amortization_months"("organization_id", "year", "month");
CREATE INDEX IF NOT EXISTS "intangible_amortization_months_org_deleted_at_idx"
  ON "intangible_amortization_months"("organization_id", "deleted_at");

DO $wave3_intangible_amort_org_fk$
BEGIN
  ALTER TABLE "intangible_amortization_months"
    ADD CONSTRAINT "intangible_amortization_months_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$wave3_intangible_amort_org_fk$;

DO $wave3_intangible_amort_asset_fk$
BEGIN
  ALTER TABLE "intangible_amortization_months"
    ADD CONSTRAINT "intangible_amortization_months_intangible_asset_id_fkey"
    FOREIGN KEY ("intangible_asset_id") REFERENCES "intangible_assets"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$wave3_intangible_amort_asset_fk$;

DO $wave3_intangible_amort_tx_fk$
BEGIN
  ALTER TABLE "intangible_amortization_months"
    ADD CONSTRAINT "intangible_amortization_months_transaction_id_fkey"
    FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$wave3_intangible_amort_tx_fk$;

-- Fiscal year close enhancements
ALTER TABLE "fiscal_year_closes" ADD COLUMN IF NOT EXISTS "protocol_json" JSONB;
ALTER TABLE "fiscal_year_closes" ADD COLUMN IF NOT EXISTS "reversed_at" TIMESTAMPTZ(6);
ALTER TABLE "fiscal_year_closes" ADD COLUMN IF NOT EXISTS "reversal_transaction_id" UUID;

DO $wave3_fy_close_reversal_fk$
BEGIN
  ALTER TABLE "fiscal_year_closes"
    ADD CONSTRAINT "fiscal_year_closes_reversal_transaction_id_fkey"
    FOREIGN KEY ("reversal_transaction_id") REFERENCES "transactions"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$wave3_fy_close_reversal_fk$;

-- Subconto types
CREATE TABLE IF NOT EXISTS "subconto_types" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "SubcontoKind" NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subconto_types_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "subconto_types_organization_id_code_key"
  ON "subconto_types"("organization_id", "code");
CREATE INDEX IF NOT EXISTS "subconto_types_organization_id_kind_idx"
  ON "subconto_types"("organization_id", "kind");

DO $wave3_subconto_type_org_fk$
BEGIN
  ALTER TABLE "subconto_types"
    ADD CONSTRAINT "subconto_types_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$wave3_subconto_type_org_fk$;

-- Account subconto config
CREATE TABLE IF NOT EXISTS "account_subconto_configs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "subconto_type_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "account_subconto_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "account_subconto_configs_account_id_sort_order_key"
  ON "account_subconto_configs"("account_id", "sort_order");
CREATE UNIQUE INDEX IF NOT EXISTS "account_subconto_configs_account_id_subconto_type_id_key"
  ON "account_subconto_configs"("account_id", "subconto_type_id");
CREATE INDEX IF NOT EXISTS "account_subconto_configs_organization_id_account_id_idx"
  ON "account_subconto_configs"("organization_id", "account_id");

DO $wave3_account_subconto_org_fk$
BEGIN
  ALTER TABLE "account_subconto_configs"
    ADD CONSTRAINT "account_subconto_configs_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$wave3_account_subconto_org_fk$;

DO $wave3_account_subconto_account_fk$
BEGIN
  ALTER TABLE "account_subconto_configs"
    ADD CONSTRAINT "account_subconto_configs_account_id_fkey"
    FOREIGN KEY ("account_id") REFERENCES "accounts"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$wave3_account_subconto_account_fk$;

DO $wave3_account_subconto_type_fk$
BEGIN
  ALTER TABLE "account_subconto_configs"
    ADD CONSTRAINT "account_subconto_configs_subconto_type_id_fkey"
    FOREIGN KEY ("subconto_type_id") REFERENCES "subconto_types"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$wave3_account_subconto_type_fk$;

-- Journal entry dimensions
CREATE TABLE IF NOT EXISTS "journal_entry_dimensions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "journal_entry_id" UUID NOT NULL,
    "subconto_type_id" UUID NOT NULL,
    "value_id" UUID,
    "value_ref" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_entry_dimensions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "journal_entry_dimensions_journal_entry_id_idx"
  ON "journal_entry_dimensions"("journal_entry_id");
CREATE INDEX IF NOT EXISTS "journal_entry_dimensions_subconto_type_id_value_id_idx"
  ON "journal_entry_dimensions"("subconto_type_id", "value_id");

DO $wave3_journal_dim_entry_fk$
BEGIN
  ALTER TABLE "journal_entry_dimensions"
    ADD CONSTRAINT "journal_entry_dimensions_journal_entry_id_fkey"
    FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$wave3_journal_dim_entry_fk$;

DO $wave3_journal_dim_type_fk$
BEGIN
  ALTER TABLE "journal_entry_dimensions"
    ADD CONSTRAINT "journal_entry_dimensions_subconto_type_id_fkey"
    FOREIGN KEY ("subconto_type_id") REFERENCES "subconto_types"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$wave3_journal_dim_type_fk$;
