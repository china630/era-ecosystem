-- CP STAFF_PROVISIONED / STAFF_DEACTIVATED linkage on construction User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "position_title" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "department" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "global_person_id" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "finance_employee_id" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "cp_employment_id" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "User_cp_employment_id_key" ON "User"("cp_employment_id");
