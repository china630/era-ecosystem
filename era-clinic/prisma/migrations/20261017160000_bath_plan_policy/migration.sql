-- Saxla default bath mode and closed-day / weekly naftalan policy.

ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "default_bath_mode" TEXT NOT NULL DEFAULT '3';
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "closed_day_spends_owed_rest" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "closed_day_resets_open_streak" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "weekly_naftalan_cap" INTEGER NOT NULL DEFAULT 5;
