-- Wave 5: advance report lines, price lists, landed cost batches, trade context, WMS bin-level, stat forms

-- Enums
DO $wave5_trade_context$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TradeContext') THEN
    CREATE TYPE "TradeContext" AS ENUM ('DOMESTIC', 'EXPORT', 'IMPORT');
  END IF;
END
$wave5_trade_context$;

DO $wave5_pick_list_status$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PickListStatus') THEN
    CREATE TYPE "PickListStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'DONE', 'CANCELLED');
  END IF;
END
$wave5_pick_list_status$;

DO $wave5_stat_period_kind$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StatReportPeriodKind') THEN
    CREATE TYPE "StatReportPeriodKind" AS ENUM ('YEAR', 'QUARTER', 'MONTH');
  END IF;
END
$wave5_stat_period_kind$;

DO $wave5_stat_export_status$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StatReportExportStatus') THEN
    CREATE TYPE "StatReportExportStatus" AS ENUM ('GENERATED', 'UPLOADED');
  END IF;
END
$wave5_stat_export_status$;

-- Advance report enhancements
ALTER TABLE "advance_reports" ADD COLUMN IF NOT EXISTS "currency_code" TEXT NOT NULL DEFAULT 'AZN';
ALTER TABLE "advance_reports" ADD COLUMN IF NOT EXISTS "cash_order_id" UUID;

CREATE INDEX IF NOT EXISTS "advance_reports_organization_id_cash_order_id_idx"
  ON "advance_reports"("organization_id", "cash_order_id");

DO $wave5_advance_cash_order_fk$
BEGIN
  ALTER TABLE "advance_reports"
    ADD CONSTRAINT "advance_reports_cash_order_id_fkey"
    FOREIGN KEY ("cash_order_id") REFERENCES "cash_orders"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$wave5_advance_cash_order_fk$;

CREATE TABLE IF NOT EXISTS "advance_report_lines" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "advance_report_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "expense_account_code" TEXT NOT NULL,
    "vat_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "receipt_url" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "advance_report_lines_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "advance_report_lines_organization_id_advance_report_id_idx"
  ON "advance_report_lines"("organization_id", "advance_report_id");
CREATE INDEX IF NOT EXISTS "advance_report_lines_advance_report_id_sort_order_idx"
  ON "advance_report_lines"("advance_report_id", "sort_order");

DO $wave5_advance_line_org_fk$
BEGIN
  ALTER TABLE "advance_report_lines"
    ADD CONSTRAINT "advance_report_lines_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$wave5_advance_line_org_fk$;

DO $wave5_advance_line_report_fk$
BEGIN
  ALTER TABLE "advance_report_lines"
    ADD CONSTRAINT "advance_report_lines_advance_report_id_fkey"
    FOREIGN KEY ("advance_report_id") REFERENCES "advance_reports"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$wave5_advance_line_report_fk$;

-- Price lists
CREATE TABLE IF NOT EXISTS "price_lists" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "currency_code" TEXT NOT NULL DEFAULT 'AZN',
    "valid_from" DATE NOT NULL,
    "valid_to" DATE,
    "channel" TEXT,
    "segment" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_lists_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "price_lists_organization_id_is_active_valid_from_idx"
  ON "price_lists"("organization_id", "is_active", "valid_from");
CREATE INDEX IF NOT EXISTS "price_lists_organization_id_channel_idx"
  ON "price_lists"("organization_id", "channel");

DO $wave5_price_list_org_fk$
BEGIN
  ALTER TABLE "price_lists"
    ADD CONSTRAINT "price_lists_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$wave5_price_list_org_fk$;

CREATE TABLE IF NOT EXISTS "price_list_lines" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "price_list_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "unit_price" DECIMAL(19,4) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_list_lines_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "price_list_lines_price_list_id_product_id_key"
  ON "price_list_lines"("price_list_id", "product_id");
CREATE INDEX IF NOT EXISTS "price_list_lines_organization_id_product_id_idx"
  ON "price_list_lines"("organization_id", "product_id");

DO $wave5_pll_org_fk$
BEGIN
  ALTER TABLE "price_list_lines"
    ADD CONSTRAINT "price_list_lines_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$wave5_pll_org_fk$;

DO $wave5_pll_list_fk$
BEGIN
  ALTER TABLE "price_list_lines"
    ADD CONSTRAINT "price_list_lines_price_list_id_fkey"
    FOREIGN KEY ("price_list_id") REFERENCES "price_lists"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$wave5_pll_list_fk$;

DO $wave5_pll_product_fk$
BEGIN
  ALTER TABLE "price_list_lines"
    ADD CONSTRAINT "price_list_lines_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$wave5_pll_product_fk$;

CREATE TABLE IF NOT EXISTS "discount_rules" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "counterparty_id" UUID,
    "price_list_id" UUID,
    "channel" TEXT,
    "min_qty" DECIMAL(19,4),
    "percent_off" DECIMAL(7,4),
    "amount_off" DECIMAL(19,4),
    "valid_from" DATE NOT NULL,
    "valid_to" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discount_rules_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "discount_rules_organization_id_is_active_valid_from_idx"
  ON "discount_rules"("organization_id", "is_active", "valid_from");
CREATE INDEX IF NOT EXISTS "discount_rules_organization_id_counterparty_id_idx"
  ON "discount_rules"("organization_id", "counterparty_id");
CREATE INDEX IF NOT EXISTS "discount_rules_organization_id_price_list_id_idx"
  ON "discount_rules"("organization_id", "price_list_id");

DO $wave5_discount_org_fk$
BEGIN
  ALTER TABLE "discount_rules"
    ADD CONSTRAINT "discount_rules_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$wave5_discount_org_fk$;

DO $wave5_discount_cp_fk$
BEGIN
  ALTER TABLE "discount_rules"
    ADD CONSTRAINT "discount_rules_counterparty_id_fkey"
    FOREIGN KEY ("counterparty_id") REFERENCES "counterparties"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$wave5_discount_cp_fk$;

DO $wave5_discount_pl_fk$
BEGIN
  ALTER TABLE "discount_rules"
    ADD CONSTRAINT "discount_rules_price_list_id_fkey"
    FOREIGN KEY ("price_list_id") REFERENCES "price_lists"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$wave5_discount_pl_fk$;

-- Landed cost / customs
ALTER TABLE "customs_declaration_items" ADD COLUMN IF NOT EXISTS "product_id" UUID;

CREATE INDEX IF NOT EXISTS "customs_declaration_items_organization_id_product_id_idx"
  ON "customs_declaration_items"("organization_id", "product_id");

DO $wave5_customs_item_product_fk$
BEGIN
  ALTER TABLE "customs_declaration_items"
    ADD CONSTRAINT "customs_declaration_items_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$wave5_customs_item_product_fk$;

CREATE TABLE IF NOT EXISTS "inventory_batches" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "batch_code" TEXT NOT NULL,
    "quantity" DECIMAL(19,4) NOT NULL,
    "unit_landed_cost" DECIMAL(19,4) NOT NULL,
    "customs_item_id" UUID,
    "purchase_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_batches_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "inventory_batches_organization_id_product_id_warehouse_id_idx"
  ON "inventory_batches"("organization_id", "product_id", "warehouse_id");
CREATE INDEX IF NOT EXISTS "inventory_batches_organization_id_customs_item_id_idx"
  ON "inventory_batches"("organization_id", "customs_item_id");
CREATE INDEX IF NOT EXISTS "inventory_batches_organization_id_purchase_id_idx"
  ON "inventory_batches"("organization_id", "purchase_id");

DO $wave5_batch_org_fk$
BEGIN
  ALTER TABLE "inventory_batches"
    ADD CONSTRAINT "inventory_batches_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$wave5_batch_org_fk$;

DO $wave5_batch_product_fk$
BEGIN
  ALTER TABLE "inventory_batches"
    ADD CONSTRAINT "inventory_batches_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$wave5_batch_product_fk$;

DO $wave5_batch_wh_fk$
BEGIN
  ALTER TABLE "inventory_batches"
    ADD CONSTRAINT "inventory_batches_warehouse_id_fkey"
    FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$wave5_batch_wh_fk$;

DO $wave5_batch_customs_fk$
BEGIN
  ALTER TABLE "inventory_batches"
    ADD CONSTRAINT "inventory_batches_customs_item_id_fkey"
    FOREIGN KEY ("customs_item_id") REFERENCES "customs_declaration_items"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$wave5_batch_customs_fk$;

DO $wave5_batch_purchase_fk$
BEGIN
  ALTER TABLE "inventory_batches"
    ADD CONSTRAINT "inventory_batches_purchase_id_fkey"
    FOREIGN KEY ("purchase_id") REFERENCES "transactions"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$wave5_batch_purchase_fk$;

-- Trade context
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "trade_context" "TradeContext" NOT NULL DEFAULT 'DOMESTIC';
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "incoterms" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "export_declaration_ref" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "country_of_destination" TEXT;

ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "trade_context" "TradeContext" NOT NULL DEFAULT 'DOMESTIC';
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "incoterms" TEXT;

-- WMS bin-level
CREATE TABLE IF NOT EXISTS "warehouse_zones" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "zone_type" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouse_zones_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "warehouse_zones_warehouse_id_code_key"
  ON "warehouse_zones"("warehouse_id", "code");
CREATE INDEX IF NOT EXISTS "warehouse_zones_organization_id_warehouse_id_idx"
  ON "warehouse_zones"("organization_id", "warehouse_id");

DO $wave5_zone_org_fk$
BEGIN
  ALTER TABLE "warehouse_zones"
    ADD CONSTRAINT "warehouse_zones_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$wave5_zone_org_fk$;

DO $wave5_zone_wh_fk$
BEGIN
  ALTER TABLE "warehouse_zones"
    ADD CONSTRAINT "warehouse_zones_warehouse_id_fkey"
    FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$wave5_zone_wh_fk$;

ALTER TABLE "warehouse_bins" ADD COLUMN IF NOT EXISTS "zone_id" UUID;

CREATE INDEX IF NOT EXISTS "warehouse_bins_organization_id_zone_id_idx"
  ON "warehouse_bins"("organization_id", "zone_id");

DO $wave5_bin_zone_fk$
BEGIN
  ALTER TABLE "warehouse_bins"
    ADD CONSTRAINT "warehouse_bins_zone_id_fkey"
    FOREIGN KEY ("zone_id") REFERENCES "warehouse_zones"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$wave5_bin_zone_fk$;

CREATE TABLE IF NOT EXISTS "bin_balances" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "bin_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "average_cost" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bin_balances_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "bin_balances_bin_id_product_id_key"
  ON "bin_balances"("bin_id", "product_id");
CREATE INDEX IF NOT EXISTS "bin_balances_organization_id_warehouse_id_product_id_idx"
  ON "bin_balances"("organization_id", "warehouse_id", "product_id");

DO $wave5_bb_org_fk$
BEGIN
  ALTER TABLE "bin_balances"
    ADD CONSTRAINT "bin_balances_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$wave5_bb_org_fk$;

DO $wave5_bb_wh_fk$
BEGIN
  ALTER TABLE "bin_balances"
    ADD CONSTRAINT "bin_balances_warehouse_id_fkey"
    FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$wave5_bb_wh_fk$;

DO $wave5_bb_bin_fk$
BEGIN
  ALTER TABLE "bin_balances"
    ADD CONSTRAINT "bin_balances_bin_id_fkey"
    FOREIGN KEY ("bin_id") REFERENCES "warehouse_bins"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$wave5_bb_bin_fk$;

DO $wave5_bb_product_fk$
BEGIN
  ALTER TABLE "bin_balances"
    ADD CONSTRAINT "bin_balances_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$wave5_bb_product_fk$;

CREATE TABLE IF NOT EXISTS "pick_lists" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "status" "PickListStatus" NOT NULL DEFAULT 'DRAFT',
    "invoice_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pick_lists_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "pick_lists_organization_id_warehouse_id_status_idx"
  ON "pick_lists"("organization_id", "warehouse_id", "status");
CREATE INDEX IF NOT EXISTS "pick_lists_organization_id_invoice_id_idx"
  ON "pick_lists"("organization_id", "invoice_id");

DO $wave5_pick_org_fk$
BEGIN
  ALTER TABLE "pick_lists"
    ADD CONSTRAINT "pick_lists_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$wave5_pick_org_fk$;

DO $wave5_pick_wh_fk$
BEGIN
  ALTER TABLE "pick_lists"
    ADD CONSTRAINT "pick_lists_warehouse_id_fkey"
    FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$wave5_pick_wh_fk$;

DO $wave5_pick_invoice_fk$
BEGIN
  ALTER TABLE "pick_lists"
    ADD CONSTRAINT "pick_lists_invoice_id_fkey"
    FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$wave5_pick_invoice_fk$;

CREATE TABLE IF NOT EXISTS "pick_list_lines" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "pick_list_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "bin_id" UUID,
    "quantity_requested" DECIMAL(19,4) NOT NULL,
    "quantity_picked" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pick_list_lines_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "pick_list_lines_organization_id_pick_list_id_idx"
  ON "pick_list_lines"("organization_id", "pick_list_id");
CREATE INDEX IF NOT EXISTS "pick_list_lines_pick_list_id_product_id_idx"
  ON "pick_list_lines"("pick_list_id", "product_id");

DO $wave5_pll2_org_fk$
BEGIN
  ALTER TABLE "pick_list_lines"
    ADD CONSTRAINT "pick_list_lines_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$wave5_pll2_org_fk$;

DO $wave5_pll2_pick_fk$
BEGIN
  ALTER TABLE "pick_list_lines"
    ADD CONSTRAINT "pick_list_lines_pick_list_id_fkey"
    FOREIGN KEY ("pick_list_id") REFERENCES "pick_lists"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$wave5_pll2_pick_fk$;

DO $wave5_pll2_product_fk$
BEGIN
  ALTER TABLE "pick_list_lines"
    ADD CONSTRAINT "pick_list_lines_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$wave5_pll2_product_fk$;

DO $wave5_pll2_bin_fk$
BEGIN
  ALTER TABLE "pick_list_lines"
    ADD CONSTRAINT "pick_list_lines_bin_id_fkey"
    FOREIGN KEY ("bin_id") REFERENCES "warehouse_bins"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$wave5_pll2_bin_fk$;

-- Stat forms
CREATE TABLE IF NOT EXISTS "stat_report_definitions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "period_kind" "StatReportPeriodKind" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "mapping_json" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stat_report_definitions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "stat_report_definitions_code_key"
  ON "stat_report_definitions"("code");
CREATE INDEX IF NOT EXISTS "stat_report_definitions_is_active_code_idx"
  ON "stat_report_definitions"("is_active", "code");

CREATE TABLE IF NOT EXISTS "stat_report_exports" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "definition_id" UUID NOT NULL,
    "period" TEXT NOT NULL,
    "status" "StatReportExportStatus" NOT NULL DEFAULT 'GENERATED',
    "file_url" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stat_report_exports_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "stat_report_exports_organization_id_definition_id_period_idx"
  ON "stat_report_exports"("organization_id", "definition_id", "period");
CREATE INDEX IF NOT EXISTS "stat_report_exports_organization_id_status_created_at_idx"
  ON "stat_report_exports"("organization_id", "status", "created_at" DESC);

DO $wave5_stat_export_org_fk$
BEGIN
  ALTER TABLE "stat_report_exports"
    ADD CONSTRAINT "stat_report_exports_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$wave5_stat_export_org_fk$;

DO $wave5_stat_export_def_fk$
BEGIN
  ALTER TABLE "stat_report_exports"
    ADD CONSTRAINT "stat_report_exports_definition_id_fkey"
    FOREIGN KEY ("definition_id") REFERENCES "stat_report_definitions"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$wave5_stat_export_def_fk$;
