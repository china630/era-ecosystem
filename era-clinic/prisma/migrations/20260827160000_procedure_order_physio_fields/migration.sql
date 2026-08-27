-- Type-gated physio order fields (CLI-49 W3). Laterality is per site, not a zone.

ALTER TABLE "ProcedureOrder" ADD COLUMN IF NOT EXISTS "physio_fields" JSONB;

DO $$ BEGIN
  CREATE TYPE "ProcedureSiteLaterality" AS ENUM ('LEFT', 'RIGHT', 'BOTH');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "procedure_order_site" ADD COLUMN IF NOT EXISTS "laterality" "ProcedureSiteLaterality";
