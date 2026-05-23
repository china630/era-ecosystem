-- Control plane: tenant billing snapshot (strangler from organizations.* billing columns).
CREATE TABLE IF NOT EXISTS "tenant_billing" (
    "organization_id" UUID NOT NULL,
    "billing_status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "subscription_plan" TEXT,
    "active_modules" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "billing_period_key" VARCHAR(7),
    "whatsapp_alerts_used" INTEGER NOT NULL DEFAULT 0,
    "ocr_pages_used" INTEGER NOT NULL DEFAULT 0,
    "accumulated_balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "current_credit_tier" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_billing_pkey" PRIMARY KEY ("organization_id")
);

INSERT INTO "tenant_billing" (
    "organization_id",
    "billing_status",
    "subscription_plan",
    "active_modules",
    "billing_period_key",
    "whatsapp_alerts_used",
    "ocr_pages_used",
    "accumulated_balance",
    "current_credit_tier",
    "updated_at"
)
SELECT
    o.id,
    o.billing_status::text,
    o.subscription_plan,
    o.active_modules,
    o.billing_period_key,
    o.whatsapp_alerts_used,
    o.ocr_pages_used,
    o.accumulated_balance,
    o.current_credit_tier::text,
    NOW()
FROM organizations o
ON CONFLICT ("organization_id") DO NOTHING;
