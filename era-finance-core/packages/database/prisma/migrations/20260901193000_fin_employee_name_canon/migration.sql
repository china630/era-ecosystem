-- Step 5: Employee names live in MDM only; drop local patronymic ops cache.
-- Run scripts/backfill-employee-patronymic-to-mdm.mjs before deploy if legacy patronymic rows exist.

ALTER TABLE "Employee" DROP COLUMN IF EXISTS "patronymic";
