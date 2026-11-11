-- CP-GUEST-APP-02 owner content fields on guest app brand
ALTER TABLE "organization_guest_apps" ADD COLUMN IF NOT EXISTS "catalog_json" JSONB;
ALTER TABLE "organization_guest_apps" ADD COLUMN IF NOT EXISTS "post_stay_message" TEXT;
ALTER TABLE "organization_guest_apps" ADD COLUMN IF NOT EXISTS "offers_json" JSONB;
ALTER TABLE "organization_guest_apps" ADD COLUMN IF NOT EXISTS "doctor_on_duty_phone" TEXT;
ALTER TABLE "organization_guest_apps" ADD COLUMN IF NOT EXISTS "lead_alert_minutes" INTEGER;
ALTER TABLE "organization_guest_apps" ADD COLUMN IF NOT EXISTS "enabled_order_kinds" JSONB;
