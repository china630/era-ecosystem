-- Procedure-load heat horizon (default 21 Asia/Baku civil days).
ALTER TABLE "Tenant"
  ADD COLUMN IF NOT EXISTS "procedure_load_horizon_days" INTEGER NOT NULL DEFAULT 21;
