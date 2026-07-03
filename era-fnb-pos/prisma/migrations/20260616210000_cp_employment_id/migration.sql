-- Plan C: CP workforce employment key for staff provision
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "cp_employment_id" TEXT;
ALTER TABLE "staff_rosters" ADD COLUMN IF NOT EXISTS "cp_employment_id" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "users_cp_employment_id_key" ON "users"("cp_employment_id");
CREATE UNIQUE INDEX IF NOT EXISTS "staff_rosters_cp_employment_id_key" ON "staff_rosters"("cp_employment_id");
