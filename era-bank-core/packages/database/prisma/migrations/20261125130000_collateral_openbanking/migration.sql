-- P1-9 CollateralItem + LoanCollateralLink; P1-3 CKR queue; P1-5 Open Banking expiresAt required

CREATE TABLE IF NOT EXISTS "collateral_items" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "bank_org_id" TEXT NOT NULL,
  "owner_id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "valuation_minor" BIGINT NOT NULL,
  "haircut_pct" DECIMAL(7,4) NOT NULL DEFAULT 0,
  "registry" TEXT NOT NULL,
  "encumbrance_ref" TEXT,
  "insured_until" TIMESTAMP(3),
  "currency" TEXT NOT NULL DEFAULT 'AZN',
  "description" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "collateral_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "collateral_items_bank_org_id_owner_id_idx"
  ON "collateral_items"("bank_org_id", "owner_id");
CREATE INDEX IF NOT EXISTS "collateral_items_organization_id_idx"
  ON "collateral_items"("organization_id");

CREATE TABLE IF NOT EXISTS "loan_collateral_links" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "bank_org_id" TEXT NOT NULL,
  "loan_id" TEXT NOT NULL,
  "collateral_item_id" TEXT NOT NULL,
  "share_pct" DECIMAL(7,4) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "loan_collateral_links_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "loan_collateral_links_loan_id_collateral_item_id_key"
  ON "loan_collateral_links"("loan_id", "collateral_item_id");
CREATE INDEX IF NOT EXISTS "loan_collateral_links_bank_org_id_loan_id_idx"
  ON "loan_collateral_links"("bank_org_id", "loan_id");
CREATE INDEX IF NOT EXISTS "loan_collateral_links_organization_id_idx"
  ON "loan_collateral_links"("organization_id");

ALTER TABLE "loan_collateral_links"
  ADD CONSTRAINT "loan_collateral_links_loan_id_fkey"
  FOREIGN KEY ("loan_id") REFERENCES "loan_contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "loan_collateral_links"
  ADD CONSTRAINT "loan_collateral_links_collateral_item_id_fkey"
  FOREIGN KEY ("collateral_item_id") REFERENCES "collateral_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "credit_debt_status_queue" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "bank_org_id" TEXT NOT NULL,
  "loan_id" TEXT NOT NULL,
  "customer_id" TEXT NOT NULL,
  "previous_status" TEXT,
  "new_status" TEXT NOT NULL,
  "changed_at" TIMESTAMP(3) NOT NULL,
  "enqueued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "submitted_at" TIMESTAMP(3),
  CONSTRAINT "credit_debt_status_queue_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "credit_debt_status_queue_bank_org_id_submitted_at_idx"
  ON "credit_debt_status_queue"("bank_org_id", "submitted_at");
CREATE INDEX IF NOT EXISTS "credit_debt_status_queue_organization_id_idx"
  ON "credit_debt_status_queue"("organization_id");

UPDATE "open_banking_consents"
SET "expires_at" = "created_at" + INTERVAL '90 days'
WHERE "expires_at" IS NULL;

ALTER TABLE "open_banking_consents" ALTER COLUMN "expires_at" SET NOT NULL;