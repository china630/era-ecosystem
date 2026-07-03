-- Wave 3: workforce employment link on Practitioner + User stamp
ALTER TABLE "Practitioner" ADD COLUMN IF NOT EXISTS "finance_employee_id" TEXT;
ALTER TABLE "Practitioner" ADD COLUMN IF NOT EXISTS "user_id" TEXT;
ALTER TABLE "Practitioner" ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "global_person_id" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "finance_employee_id" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Practitioner_finance_employee_id_key" ON "Practitioner"("finance_employee_id");
CREATE UNIQUE INDEX IF NOT EXISTS "Practitioner_user_id_key" ON "Practitioner"("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "User_finance_employee_id_key" ON "User"("finance_employee_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Practitioner_user_id_fkey'
  ) THEN
    ALTER TABLE "Practitioner"
      ADD CONSTRAINT "Practitioner_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
