-- Buyer portal identity (B2B trade credit) — ADR finance-trade-credit-control
CREATE TABLE IF NOT EXISTS "buyer_portal_accounts" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "email" TEXT NOT NULL,
  "password_hash" TEXT NOT NULL,
  "full_name" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "buyer_portal_accounts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "buyer_portal_accounts_email_key" ON "buyer_portal_accounts"("email");

CREATE TABLE IF NOT EXISTS "buyer_org_grants" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "account_id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "voen" VARCHAR(10) NOT NULL,
  "finance_counterparty_id" TEXT NOT NULL,
  "revoked_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "buyer_org_grants_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "buyer_org_grants_account_id_organization_id_finance_counterparty_id_key"
  ON "buyer_org_grants"("account_id", "organization_id", "finance_counterparty_id");
CREATE INDEX IF NOT EXISTS "buyer_org_grants_organization_id_idx" ON "buyer_org_grants"("organization_id");
CREATE INDEX IF NOT EXISTS "buyer_org_grants_voen_idx" ON "buyer_org_grants"("voen");
DO $$ BEGIN
  ALTER TABLE "buyer_org_grants"
    ADD CONSTRAINT "buyer_org_grants_account_id_fkey"
    FOREIGN KEY ("account_id") REFERENCES "buyer_portal_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "buyer_org_grants"
    ADD CONSTRAINT "buyer_org_grants_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
