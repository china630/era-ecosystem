-- A4 cutover: BodyPart Prisma enum → TEXT (ClinicLookup BODY_PART is SoR)
ALTER TABLE "ProcedureType" ALTER COLUMN "bodyPart" TYPE TEXT USING "bodyPart"::text;
ALTER TABLE "ProcedureRule" ALTER COLUMN "bodyPart" TYPE TEXT USING "bodyPart"::text;
ALTER TABLE "PatientContraindication" ALTER COLUMN "bodyPart" TYPE TEXT USING "bodyPart"::text;
ALTER TABLE "ProcedureOrder" ALTER COLUMN "bodyPart" TYPE TEXT USING "bodyPart"::text;

DROP TYPE "BodyPart";
