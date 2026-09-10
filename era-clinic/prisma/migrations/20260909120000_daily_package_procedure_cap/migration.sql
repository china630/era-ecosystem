ALTER TABLE "Tenant"
  ADD COLUMN IF NOT EXISTS "daily_package_procedure_cap" INTEGER NOT NULL DEFAULT 3;
