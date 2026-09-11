-- CLI-57: pool entitlement burn tracks which package balance line was consumed
ALTER TABLE "ProcedureOrder" ADD COLUMN IF NOT EXISTS "package_quota_code" TEXT;

CREATE INDEX IF NOT EXISTS "ProcedureOrder_package_quota_code_idx"
  ON "ProcedureOrder"("package_quota_code");

-- Backfill: in-package non-pool orders burn their own procedureCode
UPDATE "ProcedureOrder"
SET "package_quota_code" = "procedureCode"
WHERE "in_package" = true
  AND "package_quota_code" IS NULL
  AND "procedureCode" NOT LIKE '%_POOL';
