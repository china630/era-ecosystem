-- WS3: Fixed asset lifecycle fields + FixedAssetEvent + IntangibleAsset register

ALTER TABLE "fixed_assets" ADD COLUMN IF NOT EXISTS "department_id" UUID;
ALTER TABLE "fixed_assets" ADD COLUMN IF NOT EXISTS "location" TEXT;
ALTER TABLE "fixed_assets" ADD COLUMN IF NOT EXISTS "counterparty_id" UUID;
ALTER TABLE "fixed_assets" ADD COLUMN IF NOT EXISTS "revaluation_reserve" DECIMAL(19, 4) NOT NULL DEFAULT 0;
ALTER TABLE "fixed_assets" ADD COLUMN IF NOT EXISTS "disposal_date" DATE;
ALTER TABLE "fixed_assets" ADD COLUMN IF NOT EXISTS "disposal_amount" DECIMAL(19, 4);

CREATE INDEX IF NOT EXISTS "fixed_assets_organization_id_department_id_idx"
  ON "fixed_assets" ("organization_id", "department_id");
CREATE INDEX IF NOT EXISTS "fixed_assets_counterparty_id_idx"
  ON "fixed_assets" ("counterparty_id");

DO $fk$ BEGIN
  ALTER TABLE "fixed_assets"
    ADD CONSTRAINT "fixed_assets_department_id_fkey"
    FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $fk$;

DO $fk$ BEGIN
  ALTER TABLE "fixed_assets"
    ADD CONSTRAINT "fixed_assets_counterparty_id_fkey"
    FOREIGN KEY ("counterparty_id") REFERENCES "counterparties"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $fk$;

DO $enum$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FixedAssetEventType') THEN
    CREATE TYPE "FixedAssetEventType" AS ENUM (
      'ACQUIRE',
      'COMMISSION',
      'CAPITALIZE',
      'REVALUE',
      'DISPOSE',
      'TRANSFER',
      'GRATUITOUS_IN',
      'GRATUITOUS_OUT',
      'INVENTORY'
    );
  END IF;
END $enum$;

CREATE TABLE IF NOT EXISTS "fixed_asset_events" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "organization_id" UUID NOT NULL,
  "fixed_asset_id" UUID NOT NULL,
  "event_type" "FixedAssetEventType" NOT NULL,
  "amount" DECIMAL(19, 4) NOT NULL DEFAULT 0,
  "event_date" DATE NOT NULL,
  "transaction_id" UUID,
  "from_department_id" UUID,
  "to_department_id" UUID,
  "note" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fixed_asset_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "fixed_asset_events_organization_id_fixed_asset_id_idx"
  ON "fixed_asset_events" ("organization_id", "fixed_asset_id");
CREATE INDEX IF NOT EXISTS "fixed_asset_events_fixed_asset_id_event_type_idx"
  ON "fixed_asset_events" ("fixed_asset_id", "event_type");
CREATE INDEX IF NOT EXISTS "fixed_asset_events_organization_id_event_date_idx"
  ON "fixed_asset_events" ("organization_id", "event_date");

DO $fk$ BEGIN
  ALTER TABLE "fixed_asset_events"
    ADD CONSTRAINT "fixed_asset_events_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $fk$;

DO $fk$ BEGIN
  ALTER TABLE "fixed_asset_events"
    ADD CONSTRAINT "fixed_asset_events_fixed_asset_id_fkey"
    FOREIGN KEY ("fixed_asset_id") REFERENCES "fixed_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $fk$;

DO $fk$ BEGIN
  ALTER TABLE "fixed_asset_events"
    ADD CONSTRAINT "fixed_asset_events_transaction_id_fkey"
    FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $fk$;

DO $fk$ BEGIN
  ALTER TABLE "fixed_asset_events"
    ADD CONSTRAINT "fixed_asset_events_from_department_id_fkey"
    FOREIGN KEY ("from_department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $fk$;

DO $fk$ BEGIN
  ALTER TABLE "fixed_asset_events"
    ADD CONSTRAINT "fixed_asset_events_to_department_id_fkey"
    FOREIGN KEY ("to_department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $fk$;

CREATE TABLE IF NOT EXISTS "intangible_assets" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "organization_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "inventory_number" TEXT NOT NULL,
  "purchase_date" DATE NOT NULL,
  "purchase_price" DECIMAL(19, 4) NOT NULL,
  "useful_life_months" INTEGER NOT NULL,
  "salvage_value" DECIMAL(19, 4) NOT NULL DEFAULT 0,
  "depreciation_method" "FixedAssetDepreciationMethod" NOT NULL DEFAULT 'STRAIGHT_LINE',
  "status" "FixedAssetStatus" NOT NULL DEFAULT 'ACTIVE',
  "booked_amortization" DECIMAL(19, 4) NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMPTZ(6),
  "deleted_by_user_id" UUID,
  "deleted_reason" TEXT,
  CONSTRAINT "intangible_assets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "intangible_assets_organization_id_inventory_number_key"
  ON "intangible_assets" ("organization_id", "inventory_number");
CREATE INDEX IF NOT EXISTS "intangible_assets_organization_id_purchase_date_idx"
  ON "intangible_assets" ("organization_id", "purchase_date");
CREATE INDEX IF NOT EXISTS "intangible_assets_org_deleted_at_idx"
  ON "intangible_assets" ("organization_id", "deleted_at");

DO $fk$ BEGIN
  ALTER TABLE "intangible_assets"
    ADD CONSTRAINT "intangible_assets_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $fk$;

CREATE TABLE IF NOT EXISTS "intangible_amortization_months" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "organization_id" UUID NOT NULL,
  "intangible_asset_id" UUID NOT NULL,
  "year" INTEGER NOT NULL,
  "month" INTEGER NOT NULL,
  "amount" DECIMAL(19, 4) NOT NULL,
  "transaction_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMPTZ(6),
  "deleted_by_user_id" UUID,
  "deleted_reason" TEXT,
  CONSTRAINT "intangible_amortization_months_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "intangible_amortization_months_intangible_asset_id_year_month_key"
  ON "intangible_amortization_months" ("intangible_asset_id", "year", "month");
CREATE INDEX IF NOT EXISTS "intangible_amortization_months_organization_id_year_month_idx"
  ON "intangible_amortization_months" ("organization_id", "year", "month");
CREATE INDEX IF NOT EXISTS "intangible_amortization_months_org_deleted_at_idx"
  ON "intangible_amortization_months" ("organization_id", "deleted_at");

DO $fk$ BEGIN
  ALTER TABLE "intangible_amortization_months"
    ADD CONSTRAINT "intangible_amortization_months_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $fk$;

DO $fk$ BEGIN
  ALTER TABLE "intangible_amortization_months"
    ADD CONSTRAINT "intangible_amortization_months_intangible_asset_id_fkey"
    FOREIGN KEY ("intangible_asset_id") REFERENCES "intangible_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $fk$;

DO $fk$ BEGIN
  ALTER TABLE "intangible_amortization_months"
    ADD CONSTRAINT "intangible_amortization_months_transaction_id_fkey"
    FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $fk$;
