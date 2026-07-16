-- Capacity foresight debounce on Tenant
ALTER TABLE "Tenant"
  ADD COLUMN IF NOT EXISTS "last_capacity_risk_level" TEXT;
