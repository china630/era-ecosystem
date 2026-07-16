-- Clinical demographics ops cache on PatientRef (sex, DOB→age, blood, emergency contact).
-- Identity SoR remains MDM; these fields mirror hotel Guest ops-cache pattern for care UX.

CREATE TYPE "PatientSex" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'UNKNOWN');

CREATE TYPE "PatientBloodGroup" AS ENUM (
  'A_POS',
  'A_NEG',
  'B_POS',
  'B_NEG',
  'AB_POS',
  'AB_NEG',
  'O_POS',
  'O_NEG',
  'UNKNOWN'
);

ALTER TABLE "PatientRef" ADD COLUMN "sex" "PatientSex" NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE "PatientRef" ADD COLUMN "birthDate" DATE;
ALTER TABLE "PatientRef" ADD COLUMN "blood_group" "PatientBloodGroup" NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE "PatientRef" ADD COLUMN "emergency_contact_name" TEXT;
ALTER TABLE "PatientRef" ADD COLUMN "emergency_contact_phone" TEXT;
