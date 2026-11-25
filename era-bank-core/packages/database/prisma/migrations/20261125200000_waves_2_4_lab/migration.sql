-- Wave 2–4 lab: lease IFRS16 fields, MFI collection sheets, OB SCA, webhook outbox

ALTER TABLE "lease_contracts" ADD COLUMN IF NOT EXISTS "net_investment_minor" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "lease_contracts" ADD COLUMN IF NOT EXISTS "accrued_finance_income_minor" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "lease_contracts" ADD COLUMN IF NOT EXISTS "last_finance_accrual_date" TIMESTAMP(3);

ALTER TABLE "borrower_groups" ADD COLUMN IF NOT EXISTS "officer_id" TEXT;
CREATE INDEX IF NOT EXISTS "borrower_groups_bank_org_id_officer_id_idx" ON "borrower_groups"("bank_org_id", "officer_id");

DO $$ BEGIN
  CREATE TYPE "CollectionSheetStatus" AS ENUM ('OPEN', 'COLLECTED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "collection_sheets" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "bank_org_id" TEXT NOT NULL,
  "group_id" TEXT NOT NULL,
  "meeting_date" TIMESTAMP(3) NOT NULL,
  "status" "CollectionSheetStatus" NOT NULL DEFAULT 'OPEN',
  "lines_json" JSONB NOT NULL DEFAULT '[]',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "collection_sheets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "collection_sheets_bank_org_id_group_id_idx" ON "collection_sheets"("bank_org_id", "group_id");
CREATE INDEX IF NOT EXISTS "collection_sheets_organization_id_idx" ON "collection_sheets"("organization_id");

DO $$ BEGIN
  ALTER TABLE "collection_sheets" ADD CONSTRAINT "collection_sheets_group_id_fkey"
    FOREIGN KEY ("group_id") REFERENCES "borrower_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "open_banking_consents" ADD COLUMN IF NOT EXISTS "sca_challenge_id" TEXT;

DO $$ BEGIN
  CREATE TYPE "WebhookOutboxStatus" AS ENUM ('PENDING', 'DELIVERED', 'FAILED', 'DEAD');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "webhook_delivery_outbox" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "bank_org_id" TEXT NOT NULL,
  "subscription_id" TEXT NOT NULL,
  "event_type" TEXT NOT NULL,
  "payload_json" JSONB NOT NULL,
  "status" "WebhookOutboxStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "webhook_delivery_outbox_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "webhook_delivery_outbox_bank_org_id_status_next_attempt_at_idx"
  ON "webhook_delivery_outbox"("bank_org_id", "status", "next_attempt_at");
CREATE INDEX IF NOT EXISTS "webhook_delivery_outbox_organization_id_idx"
  ON "webhook_delivery_outbox"("organization_id");

DO $$ BEGIN
  ALTER TABLE "webhook_delivery_outbox" ADD CONSTRAINT "webhook_delivery_outbox_subscription_id_fkey"
    FOREIGN KEY ("subscription_id") REFERENCES "webhook_subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "credit_registry_submit_journal" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "bank_org_id" TEXT NOT NULL,
  "batch_id" TEXT NOT NULL,
  "record_count" INTEGER NOT NULL,
  "valid" BOOLEAN NOT NULL,
  "submitted_live" BOOLEAN NOT NULL DEFAULT false,
  "provider" TEXT NOT NULL,
  "errors_json" JSONB NOT NULL DEFAULT '[]',
  "response_json" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "credit_registry_submit_journal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "credit_registry_submit_journal_bank_org_id_created_at_idx"
  ON "credit_registry_submit_journal"("bank_org_id", "created_at");
CREATE INDEX IF NOT EXISTS "credit_registry_submit_journal_organization_id_idx"
  ON "credit_registry_submit_journal"("organization_id");
