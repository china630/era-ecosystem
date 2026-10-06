-- Workforce staff provision: bind a retail login to a control-plane employment.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "department" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "positionTitle" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "global_person_id" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "finance_employee_id" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "cp_employment_id" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS "User_finance_employee_id_key" ON "User"("finance_employee_id");
CREATE UNIQUE INDEX IF NOT EXISTS "User_cp_employment_id_key" ON "User"("cp_employment_id");

CREATE TABLE IF NOT EXISTS "user_logins" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_logins_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "user_logins_organizationId_created_at_idx" ON "user_logins"("organizationId", "created_at");
CREATE INDEX IF NOT EXISTS "user_logins_userId_idx" ON "user_logins"("userId");

DO $$ BEGIN
  ALTER TABLE "user_logins" ADD CONSTRAINT "user_logins_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
