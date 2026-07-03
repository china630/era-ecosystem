-- Wave 1: MDM-only identity storage — drop plaintext FIN/passport from clinic satellite DB
ALTER TABLE "PatientRef" DROP COLUMN IF EXISTS "finCode";
ALTER TABLE "PatientRef" DROP COLUMN IF EXISTS "passportNumber";
ALTER TABLE "PatientRef" DROP COLUMN IF EXISTS "issuingCountry";

ALTER TABLE "Practitioner" DROP COLUMN IF EXISTS "fin_code";
ALTER TABLE "Practitioner" DROP COLUMN IF EXISTS "passport_number";
ALTER TABLE "Practitioner" DROP COLUMN IF EXISTS "issuing_country";
ALTER TABLE "Practitioner" DROP COLUMN IF EXISTS "phone";
