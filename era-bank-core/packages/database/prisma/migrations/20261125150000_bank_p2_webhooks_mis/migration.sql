-- P2-2 webhook subscriptions scaffold

CREATE TABLE IF NOT EXISTS "webhook_subscriptions" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "bank_org_id" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "secret_enc" TEXT,
  "events_json" JSONB NOT NULL DEFAULT '[]',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "webhook_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "webhook_subscriptions_bank_org_id_active_idx"
  ON "webhook_subscriptions"("bank_org_id", "active");

CREATE INDEX IF NOT EXISTS "webhook_subscriptions_organization_id_idx"
  ON "webhook_subscriptions"("organization_id");