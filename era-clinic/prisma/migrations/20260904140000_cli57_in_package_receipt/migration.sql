-- CLI-57 hardening: explicit in-package flag + payment receipt ref for extras Pay
ALTER TABLE "ProcedureOrder" ADD COLUMN IF NOT EXISTS "in_package" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ProcedureOrder" ADD COLUMN IF NOT EXISTS "payment_receipt_ref" TEXT;

CREATE INDEX IF NOT EXISTS "ProcedureOrder_in_package_idx" ON "ProcedureOrder"("in_package");

-- Backfill historical in-quota rows (zero charge, not pending pay)
UPDATE "ProcedureOrder"
SET "in_package" = true
WHERE "amount_net" <= 0
  AND "status"::text <> 'PENDING_PAY';
