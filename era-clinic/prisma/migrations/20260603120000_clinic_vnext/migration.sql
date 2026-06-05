-- Clinic vNext: scheduling resources, origin/billing, ICD, programs, cashier, enums

CREATE TYPE "PatientOrigin" AS ENUM ('WALK_IN', 'IN_HOUSE');
CREATE TYPE "AppointmentStatus" AS ENUM ('SCHEDULED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'NO_SHOW', 'CANCELLED');
CREATE TYPE "VisitStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE "BillingTarget" AS ENUM ('FINANCE', 'HOTEL_FOLIO');
CREATE TYPE "ResourceKind" AS ENUM ('ROOM', 'EQUIPMENT');
CREATE TYPE "ProcedureOrderStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE "ClinicReceiptStatus" AS ENUM ('OPEN', 'PAID', 'VOID');

ALTER TABLE "ClinicalEpisode" ADD COLUMN IF NOT EXISTS "patientOrigin" "PatientOrigin" NOT NULL DEFAULT 'IN_HOUSE';
ALTER TABLE "ClinicalEpisode" ADD COLUMN IF NOT EXISTS "programCode" TEXT;

ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "status" "AppointmentStatus" NOT NULL DEFAULT 'SCHEDULED';
ALTER TABLE "Visit" ADD COLUMN IF NOT EXISTS "status" "VisitStatus" NOT NULL DEFAULT 'IN_PROGRESS';
ALTER TABLE "Visit" ADD COLUMN IF NOT EXISTS "patientOrigin" "PatientOrigin" NOT NULL DEFAULT 'WALK_IN';
ALTER TABLE "Visit" ADD COLUMN IF NOT EXISTS "billingTarget" "BillingTarget" NOT NULL DEFAULT 'FINANCE';
ALTER TABLE "Visit" ADD COLUMN IF NOT EXISTS "reservationId" TEXT;
ALTER TABLE "Visit" ADD COLUMN IF NOT EXISTS "roomNumber" TEXT;

CREATE TABLE IF NOT EXISTS "Room" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Room_code_key" ON "Room"("code");

CREATE TABLE IF NOT EXISTS "Resource" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "ResourceKind" NOT NULL DEFAULT 'EQUIPMENT',
    "capacity" INTEGER NOT NULL DEFAULT 1,
    "roomId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Resource_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Resource_code_key" ON "Resource"("code");
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "ResourceBooking" (
    "id" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "practitionerId" TEXT,
    "appointmentId" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ResourceBooking_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ResourceBooking_appointmentId_key" ON "ResourceBooking"("appointmentId");
CREATE INDEX IF NOT EXISTS "ResourceBooking_resourceId_startsAt_endsAt_idx" ON "ResourceBooking"("resourceId", "startsAt", "endsAt");
ALTER TABLE "ResourceBooking" ADD CONSTRAINT "ResourceBooking_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ResourceBooking" ADD CONSTRAINT "ResourceBooking_practitionerId_fkey" FOREIGN KEY ("practitionerId") REFERENCES "Practitioner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ResourceBooking" ADD CONSTRAINT "ResourceBooking_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "IcdCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    CONSTRAINT "IcdCode_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "IcdCode_code_key" ON "IcdCode"("code");

ALTER TABLE "ClinicalDiagnosis" ADD COLUMN IF NOT EXISTS "icdCodeId" TEXT;
ALTER TABLE "ClinicalDiagnosis" ADD COLUMN IF NOT EXISTS "icdCodeText" TEXT;
ALTER TABLE "ClinicalDiagnosis" DROP COLUMN IF EXISTS "icdCode";
ALTER TABLE "ClinicalDiagnosis" ADD CONSTRAINT "ClinicalDiagnosis_icdCodeId_fkey" FOREIGN KEY ("icdCodeId") REFERENCES "IcdCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "ProgramTemplate" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "durationDays" INTEGER NOT NULL,
    CONSTRAINT "ProgramTemplate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ProgramTemplate_code_key" ON "ProgramTemplate"("code");

CREATE TABLE IF NOT EXISTS "ProgramTemplateProcedure" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "procedureCode" TEXT NOT NULL,
    "procedureName" TEXT NOT NULL,
    "quotaTotal" INTEGER NOT NULL,
    "minGapMinutes" INTEGER,
    "avoidAfterHour" INTEGER,
    CONSTRAINT "ProgramTemplateProcedure_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ProgramTemplateProcedure_templateId_idx" ON "ProgramTemplateProcedure"("templateId");
ALTER TABLE "ProgramTemplateProcedure" ADD CONSTRAINT "ProgramTemplateProcedure_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ProgramTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "ProgramInstance" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "reservationId" TEXT,
    "programCode" TEXT NOT NULL,
    "startsOn" TIMESTAMP(3) NOT NULL,
    "endsOn" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProgramInstance_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ProgramInstance_episodeId_key" ON "ProgramInstance"("episodeId");
CREATE INDEX IF NOT EXISTS "ProgramInstance_reservationId_idx" ON "ProgramInstance"("reservationId");
ALTER TABLE "ProgramInstance" ADD CONSTRAINT "ProgramInstance_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ProgramTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProgramInstance" ADD CONSTRAINT "ProgramInstance_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "ClinicalEpisode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "ProgramProcedureBalance" (
    "id" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "procedureCode" TEXT NOT NULL,
    "quotaTotal" INTEGER NOT NULL,
    "quotaUsed" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ProgramProcedureBalance_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ProgramProcedureBalance_instanceId_procedureCode_key" ON "ProgramProcedureBalance"("instanceId", "procedureCode");
ALTER TABLE "ProgramProcedureBalance" ADD CONSTRAINT "ProgramProcedureBalance_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "ProgramInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "ProcedureOrder" (
    "id" TEXT NOT NULL,
    "visitId" TEXT,
    "patientRefId" TEXT NOT NULL,
    "procedureCode" TEXT NOT NULL,
    "procedureName" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" "ProcedureOrderStatus" NOT NULL DEFAULT 'SCHEDULED',
    "amountNet" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "patientOrigin" "PatientOrigin" NOT NULL DEFAULT 'WALK_IN',
    "reservationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProcedureOrder_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ProcedureOrder_scheduledAt_status_idx" ON "ProcedureOrder"("scheduledAt", "status");
CREATE INDEX IF NOT EXISTS "ProcedureOrder_patientRefId_idx" ON "ProcedureOrder"("patientRefId");
ALTER TABLE "ProcedureOrder" ADD CONSTRAINT "ProcedureOrder_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProcedureOrder" ADD CONSTRAINT "ProcedureOrder_patientRefId_fkey" FOREIGN KEY ("patientRefId") REFERENCES "PatientRef"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "ClinicShift" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    CONSTRAINT "ClinicShift_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ClinicShift_code_key" ON "ClinicShift"("code");

CREATE TABLE IF NOT EXISTS "ClinicReceipt" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "visitId" TEXT,
    "status" "ClinicReceiptStatus" NOT NULL DEFAULT 'OPEN',
    "amountNet" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paymentMethod" TEXT,
    "fiscalReceiptId" TEXT,
    "fiscalQrPayload" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClinicReceipt_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ClinicReceipt_shiftId_status_idx" ON "ClinicReceipt"("shiftId", "status");
ALTER TABLE "ClinicReceipt" ADD CONSTRAINT "ClinicReceipt_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "ClinicShift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClinicReceipt" ADD CONSTRAINT "ClinicReceipt_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "ClinicReceiptLine" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "serviceCode" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    CONSTRAINT "ClinicReceiptLine_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ClinicReceiptLine_receiptId_idx" ON "ClinicReceiptLine"("receiptId");
ALTER TABLE "ClinicReceiptLine" ADD CONSTRAINT "ClinicReceiptLine_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "ClinicReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "Appointment_scheduledAt_status_idx" ON "Appointment"("scheduledAt", "status");
CREATE INDEX IF NOT EXISTS "Visit_patientRefId_status_idx" ON "Visit"("patientRefId", "status");
