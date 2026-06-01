-- Backfill tenant_billing from organizations (table created in control_plane_baseline).
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
    o.billing_status,
    o.subscription_plan,
    o.active_modules,
    o.billing_period_key,
    o.whatsapp_alerts_used,
    o.ocr_pages_used,
    o.accumulated_balance,
    o.current_credit_tier,
    NOW()
FROM organizations o
WHERE EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'organizations'
)
ON CONFLICT ("organization_id") DO NOTHING;
