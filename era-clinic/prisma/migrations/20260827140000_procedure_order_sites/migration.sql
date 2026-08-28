-- Ordered S chips on ProcedureOrder (CLI-49 W2). Coarse bodyPart stays derived.

DO $$ BEGIN
  CREATE TYPE "ProcedureSiteApplyMode" AS ENUM ('TOGETHER', 'TURN');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "ProcedureOrder" ADD COLUMN IF NOT EXISTS "site_apply_mode" "ProcedureSiteApplyMode";

CREATE TABLE IF NOT EXISTS "procedure_order_site" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "procedure_order_id" TEXT NOT NULL,
  "site_id" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "procedure_order_site_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "procedure_order_site_procedure_order_id_site_id_key"
  ON "procedure_order_site"("procedure_order_id", "site_id");
CREATE INDEX IF NOT EXISTS "procedure_order_site_procedure_order_id_sort_order_idx"
  ON "procedure_order_site"("procedure_order_id", "sort_order");
CREATE INDEX IF NOT EXISTS "procedure_order_site_organization_id_idx"
  ON "procedure_order_site"("organization_id");

DO $$ BEGIN
  ALTER TABLE "procedure_order_site"
    ADD CONSTRAINT "procedure_order_site_procedure_order_id_fkey"
    FOREIGN KEY ("procedure_order_id") REFERENCES "ProcedureOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "procedure_order_site"
    ADD CONSTRAINT "procedure_order_site_site_id_fkey"
    FOREIGN KEY ("site_id") REFERENCES "physio_site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
