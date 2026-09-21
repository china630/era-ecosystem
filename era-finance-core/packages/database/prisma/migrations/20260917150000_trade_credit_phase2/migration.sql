-- Phase 2 trade credit: enrichment runs, buyer notify prefs, factor leads, policy enrich flags

ALTER TABLE "trade_credit_policies"
  ADD COLUMN IF NOT EXISTS "enrich_risky_forces_d" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "enrich_voen_inactive_forces_d" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "trade_credit_enrichment_runs" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "organization_id" UUID NOT NULL,
  "counterparty_id" UUID NOT NULL,
  "facility_id" UUID,
  "provider" TEXT NOT NULL,
  "paid_meter_units" INTEGER NOT NULL DEFAULT 1,
  "billed" BOOLEAN NOT NULL DEFAULT false,
  "consent_purpose" TEXT NOT NULL DEFAULT 'trade_credit_underwriting',
  "payload_json" JSONB,
  "risky_taxpayer" BOOLEAN,
  "voen_inactive" BOOLEAN,
  "voen_name" TEXT,
  "error_message" TEXT,
  "created_by_user_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT "trade_credit_enrichment_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "trade_credit_enrichment_runs_org_cp_idx"
  ON "trade_credit_enrichment_runs" ("organization_id", "counterparty_id");
CREATE INDEX IF NOT EXISTS "trade_credit_enrichment_runs_org_created_idx"
  ON "trade_credit_enrichment_runs" ("organization_id", "created_at");

DO $$ BEGIN
  ALTER TABLE "trade_credit_enrichment_runs"
    ADD CONSTRAINT "trade_credit_enrichment_runs_org_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "trade_credit_enrichment_runs"
    ADD CONSTRAINT "trade_credit_enrichment_runs_cp_fkey"
    FOREIGN KEY ("counterparty_id") REFERENCES "counterparties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "trade_credit_buyer_prefs" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "organization_id" UUID NOT NULL,
  "counterparty_id" UUID NOT NULL,
  "notify_opt_in" BOOLEAN NOT NULL DEFAULT false,
  "notify_channel" TEXT,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT "trade_credit_buyer_prefs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "trade_credit_buyer_prefs_org_cp_uidx"
  ON "trade_credit_buyer_prefs" ("organization_id", "counterparty_id");

DO $$ BEGIN
  ALTER TABLE "trade_credit_buyer_prefs"
    ADD CONSTRAINT "trade_credit_buyer_prefs_org_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "trade_credit_buyer_prefs"
    ADD CONSTRAINT "trade_credit_buyer_prefs_cp_fkey"
    FOREIGN KEY ("counterparty_id") REFERENCES "counterparties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "trade_credit_factor_leads" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "organization_id" UUID NOT NULL,
  "counterparty_id" UUID NOT NULL,
  "invoice_id" UUID,
  "partner_key" TEXT NOT NULL DEFAULT 'default',
  "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
  "note" TEXT,
  "hashed_stats_json" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT "trade_credit_factor_leads_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "trade_credit_factor_leads_org_created_idx"
  ON "trade_credit_factor_leads" ("organization_id", "created_at");

DO $$ BEGIN
  ALTER TABLE "trade_credit_factor_leads"
    ADD CONSTRAINT "trade_credit_factor_leads_org_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "trade_credit_factor_leads"
    ADD CONSTRAINT "trade_credit_factor_leads_cp_fkey"
    FOREIGN KEY ("counterparty_id") REFERENCES "counterparties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
