ALTER TABLE "staff_rosters" ADD COLUMN IF NOT EXISTS "global_person_id" TEXT;
ALTER TABLE "staff_rosters" ADD COLUMN IF NOT EXISTS "finance_employee_id" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "global_person_id" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "finance_employee_id" TEXT;
