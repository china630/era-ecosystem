-- Wave 3: workforce stamp on hotel User (provision parity)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "global_person_id" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "finance_employee_id" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "User_finance_employee_id_key" ON "User"("finance_employee_id");
