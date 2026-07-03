-- Plan C: CP workforce employment key for staff provision
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "cp_employment_id" TEXT;
ALTER TABLE "Practitioner" ADD COLUMN IF NOT EXISTS "cp_employment_id" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "User_cp_employment_id_key" ON "User"("cp_employment_id");
CREATE UNIQUE INDEX IF NOT EXISTS "Practitioner_cp_employment_id_key" ON "Practitioner"("cp_employment_id");
