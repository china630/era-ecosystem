-- Catch-up: procedure planning / contraindications columns never shipped as a migration
-- (schema had ProcedureType, bodyPart, procedureTypeId, etc. while DB lagged).

CREATE TYPE "BodyPart" AS ENUM (
  'HEAD',
  'NECK',
  'CHEST',
  'BACK',
  'ABDOMEN',
  'ARM_LEFT',
  'ARM_RIGHT',
  'LEG_LEFT',
  'LEG_RIGHT',
  'FULL_BODY'
);

CREATE TYPE "ProcedureRuleKind" AS ENUM ('SEQUENCE_GAP', 'MUTUAL_EXCLUSION');

CREATE TABLE "ProcedureType" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "durationMin" INTEGER NOT NULL DEFAULT 30,
    "resourceKind" "ResourceKind",
    "resourceCode" TEXT,
    "bodyPart" "BodyPart",
    "afterLunchAllowed" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "ProcedureType_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProcedureType_code_key" ON "ProcedureType"("code");
CREATE INDEX "ProcedureType_resourceCode_idx" ON "ProcedureType"("resourceCode");

CREATE TABLE "ProcedureRule" (
    "id" TEXT NOT NULL,
    "beforeCode" TEXT NOT NULL,
    "afterCode" TEXT NOT NULL,
    "kind" "ProcedureRuleKind" NOT NULL DEFAULT 'SEQUENCE_GAP',
    "minGapMinutes" INTEGER NOT NULL DEFAULT 0,
    "bodyPart" "BodyPart",
    CONSTRAINT "ProcedureRule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProcedureRule_beforeCode_idx" ON "ProcedureRule"("beforeCode");
CREATE INDEX "ProcedureRule_afterCode_idx" ON "ProcedureRule"("afterCode");

CREATE TABLE "PatientContraindication" (
    "id" TEXT NOT NULL,
    "patientRefId" TEXT NOT NULL,
    "bodyPart" "BodyPart" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PatientContraindication_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PatientContraindication_patientRefId_idx" ON "PatientContraindication"("patientRefId");

ALTER TABLE "PatientContraindication"
  ADD CONSTRAINT "PatientContraindication_patientRefId_fkey"
  FOREIGN KEY ("patientRefId") REFERENCES "PatientRef"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProcedureOrder" ADD COLUMN "procedureTypeId" TEXT;
ALTER TABLE "ProcedureOrder" ADD COLUMN "endsAt" TIMESTAMP(3);
ALTER TABLE "ProcedureOrder" ADD COLUMN "sequenceIndex" INTEGER;
ALTER TABLE "ProcedureOrder" ADD COLUMN "bodyPart" "BodyPart";
ALTER TABLE "ProcedureOrder" ADD COLUMN "resourceId" TEXT;

CREATE INDEX "ProcedureOrder_resourceId_scheduledAt_idx"
  ON "ProcedureOrder"("resourceId", "scheduledAt");

ALTER TABLE "ProcedureOrder"
  ADD CONSTRAINT "ProcedureOrder_procedureTypeId_fkey"
  FOREIGN KEY ("procedureTypeId") REFERENCES "ProcedureType"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProcedureOrder"
  ADD CONSTRAINT "ProcedureOrder_resourceId_fkey"
  FOREIGN KEY ("resourceId") REFERENCES "Resource"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ResourceBooking" ADD COLUMN "procedureOrderId" TEXT;

CREATE UNIQUE INDEX "ResourceBooking_procedureOrderId_key"
  ON "ResourceBooking"("procedureOrderId");

ALTER TABLE "ResourceBooking"
  ADD CONSTRAINT "ResourceBooking_procedureOrderId_fkey"
  FOREIGN KEY ("procedureOrderId") REFERENCES "ProcedureOrder"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
