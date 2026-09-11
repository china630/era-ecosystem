-- ProcedureType.allowed_site_codes: doctor may only pick these PhysioSite codes.
ALTER TABLE "ProcedureType"
  ADD COLUMN IF NOT EXISTS "allowed_site_codes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
