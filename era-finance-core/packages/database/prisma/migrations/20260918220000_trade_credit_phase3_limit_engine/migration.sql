-- Phase 3: working-capital suggested limit + decision log

DO $$ BEGIN
  CREATE TYPE "TradeCreditProposedKind" AS ENUM (
    'WORKING_CAPITAL',
    'TRIAL',
    'RESTORE',
    'ENRICH_HAIRCUT',
    'A_RAISE'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "trade_credit_facilities"
  ADD COLUMN IF NOT EXISTS "proposed_kind" "TradeCreditProposedKind",
  ADD COLUMN IF NOT EXISTS "suggested_limit" DECIMAL(19, 4);

ALTER TABLE "trade_credit_policies"
  ADD COLUMN IF NOT EXISTS "limit_k" DECIMAL(8, 4) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "trial_limit_azn" DECIMAL(19, 4) NOT NULL DEFAULT 500,
  ADD COLUMN IF NOT EXISTS "suggested_cap_azn" DECIMAL(19, 4),
  ADD COLUMN IF NOT EXISTS "group_mult_b" DECIMAL(8, 4) NOT NULL DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS "group_mult_c" DECIMAL(8, 4) NOT NULL DEFAULT 0.3,
  ADD COLUMN IF NOT EXISTS "partial_pay_haircut" DECIMAL(8, 4) NOT NULL DEFAULT 0.8,
  ADD COLUMN IF NOT EXISTS "partial_pay_threshold" DECIMAL(8, 4) NOT NULL DEFAULT 0.3,
  ADD COLUMN IF NOT EXISTS "concentration_haircut" DECIMAL(8, 4) NOT NULL DEFAULT 0.7,
  ADD COLUMN IF NOT EXISTS "concentration_threshold" DECIMAL(8, 4) NOT NULL DEFAULT 0.8,
  ADD COLUMN IF NOT EXISTS "enrich_ttl_days" INTEGER NOT NULL DEFAULT 90,
  ADD COLUMN IF NOT EXISTS "enrich_haircut" DECIMAL(8, 4) NOT NULL DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS "restore_proposal_enabled" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS "trade_credit_limit_decisions" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "organization_id" UUID NOT NULL,
  "counterparty_id" UUID NOT NULL,
  "facility_id" UUID NOT NULL,
  "kind" "TradeCreditProposedKind" NOT NULL,
  "old_limit" DECIMAL(19, 4) NOT NULL,
  "new_limit" DECIMAL(19, 4) NOT NULL,
  "accepted" BOOLEAN NOT NULL,
  "reasons_json" JSONB,
  "features_json" JSONB,
  "decided_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "followup_max_dpd30" INTEGER,
  "followup_at" TIMESTAMPTZ(6),
  CONSTRAINT "trade_credit_limit_decisions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "trade_credit_limit_decisions_org_decided_idx"
  ON "trade_credit_limit_decisions" ("organization_id", "decided_at");
CREATE INDEX IF NOT EXISTS "trade_credit_limit_decisions_org_cp_idx"
  ON "trade_credit_limit_decisions" ("organization_id", "counterparty_id");
CREATE INDEX IF NOT EXISTS "trade_credit_limit_decisions_followup_idx"
  ON "trade_credit_limit_decisions" ("organization_id", "followup_at")
  WHERE "followup_at" IS NULL AND "accepted" = true;

DO $$ BEGIN
  ALTER TABLE "trade_credit_limit_decisions"
    ADD CONSTRAINT "trade_credit_limit_decisions_org_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "trade_credit_limit_decisions"
    ADD CONSTRAINT "trade_credit_limit_decisions_cp_fkey"
    FOREIGN KEY ("counterparty_id") REFERENCES "counterparties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "trade_credit_limit_decisions"
    ADD CONSTRAINT "trade_credit_limit_decisions_facility_fkey"
    FOREIGN KEY ("facility_id") REFERENCES "trade_credit_facilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
