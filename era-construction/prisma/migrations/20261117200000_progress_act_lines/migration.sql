-- Progress act ops SOV lines + optional Finance contract ref (not a ledger).
ALTER TABLE "ProgressAct" ADD COLUMN IF NOT EXISTS "finance_contract_id" TEXT;

CREATE TABLE IF NOT EXISTS "ProgressActLine" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "progress_act_id" TEXT NOT NULL,
    "boq_line_id" TEXT,
    "item_code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "qty" DECIMAL(12,3) NOT NULL,
    "amountNet" DECIMAL(12,2) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProgressActLine_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProgressActLine_progress_act_id_sort_order_idx" ON "ProgressActLine"("progress_act_id", "sort_order");
CREATE INDEX IF NOT EXISTS "ProgressActLine_organization_id_idx" ON "ProgressActLine"("organization_id");

DO $$ BEGIN
  ALTER TABLE "ProgressActLine" ADD CONSTRAINT "ProgressActLine_progress_act_id_fkey" FOREIGN KEY ("progress_act_id") REFERENCES "ProgressAct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ProgressActLine" ADD CONSTRAINT "ProgressActLine_boq_line_id_fkey" FOREIGN KEY ("boq_line_id") REFERENCES "BoqLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
