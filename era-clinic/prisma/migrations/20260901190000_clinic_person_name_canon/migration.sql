-- Step 4: PatientSex without OTHER; Practitioner name part columns (ops cache).
-- PatientRef physical columns given_name / father_name / surname unchanged (Prisma field rename only).

UPDATE "PatientRef" SET sex = 'UNKNOWN' WHERE sex = 'OTHER';

ALTER TYPE "PatientSex" RENAME TO "PatientSex_old";
CREATE TYPE "PatientSex" AS ENUM ('MALE', 'FEMALE', 'UNKNOWN');

ALTER TABLE "PatientRef" ALTER COLUMN sex DROP DEFAULT;
ALTER TABLE "PatientRef" ALTER COLUMN sex TYPE "PatientSex" USING (
  CASE sex::text
    WHEN 'OTHER' THEN 'UNKNOWN'::"PatientSex"
    ELSE sex::text::"PatientSex"
  END
);
ALTER TABLE "PatientRef" ALTER COLUMN sex SET DEFAULT 'UNKNOWN';

DROP TYPE "PatientSex_old";

ALTER TABLE "Practitioner" ADD COLUMN IF NOT EXISTS "first_name" TEXT;
ALTER TABLE "Practitioner" ADD COLUMN IF NOT EXISTS "middle_name" TEXT;
ALTER TABLE "Practitioner" ADD COLUMN IF NOT EXISTS "last_name" TEXT;
