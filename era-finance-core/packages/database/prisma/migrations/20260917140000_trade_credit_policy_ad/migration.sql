-- Phase 1: A–D policy fields on facility + org policy thresholds.

CREATE TYPE "TradeCreditPolicyGroup" AS ENUM ('A', 'B', 'C', 'D');

ALTER TABLE "trade_credit_facilities"
  ADD COLUMN IF NOT EXISTS "policy_group" "TradeCreditPolicyGroup",
  ADD COLUMN IF NOT EXISTS "policy_group_manual" "TradeCreditPolicyGroup",
  ADD COLUMN IF NOT EXISTS "policy_computed_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "policy_reasons_json" JSONB,
  ADD COLUMN IF NOT EXISTS "auto_raise_muted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "proposed_limit" DECIMAL(19,4),
  ADD COLUMN IF NOT EXISTS "proposed_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "limit_before_block" DECIMAL(19,4);

CREATE INDEX IF NOT EXISTS "trade_credit_facilities_organization_id_policy_group_idx"
  ON "trade_credit_facilities"("organization_id", "policy_group");

CREATE TABLE IF NOT EXISTS "trade_credit_policies" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "organization_id" UUID NOT NULL,
  "auto_raise_enabled" BOOLEAN NOT NULL DEFAULT false,
  "auto_d_max_dpd" INTEGER NOT NULL DEFAULT 90,
  "auto_raise_pct" DECIMAL(8,4) NOT NULL DEFAULT 20,
  "auto_raise_cap_azn" DECIMAL(19,4),
  "grant_ttl_hours_a" INTEGER NOT NULL DEFAULT 24,
  "grant_ttl_hours_b" INTEGER NOT NULL DEFAULT 24,
  "grant_ttl_hours_c" INTEGER NOT NULL DEFAULT 8,
  "group_c_require_confirm" BOOLEAN NOT NULL DEFAULT false,
  "min_paid_invoices" INTEGER NOT NULL DEFAULT 3,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "trade_credit_policies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "trade_credit_policies_organization_id_key"
  ON "trade_credit_policies"("organization_id");

ALTER TABLE "trade_credit_policies"
  ADD CONSTRAINT "trade_credit_policies_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
