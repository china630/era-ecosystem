-- Platform-granted billing coverage ("covered until, no payment required").
ALTER TABLE "organization_subscriptions"
  ADD COLUMN IF NOT EXISTS "billing_covered_until" TIMESTAMPTZ(6);
