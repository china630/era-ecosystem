-- Wave 3: SAN-PKG + PROC-SCHED

CREATE TYPE "ProcedureAppointmentStatus" AS ENUM ('BOOKED', 'FINISHED', 'NO_SHOW');

CREATE TABLE "RatePlanPackageLine" (
    "id" TEXT NOT NULL,
    "ratePlanId" TEXT NOT NULL,
    "revenueCodeId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "RatePlanPackageLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProcedureService" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "durationMin" INTEGER NOT NULL DEFAULT 30,
    "defaultAmount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProcedureService_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RatePlanProcedureInclusion" (
    "ratePlanId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    CONSTRAINT "RatePlanProcedureInclusion_pkey" PRIMARY KEY ("ratePlanId","serviceId")
);

CREATE TABLE "ProcedureAppointment" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "staffName" TEXT,
    "placeCode" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "status" "ProcedureAppointmentStatus" NOT NULL DEFAULT 'BOOKED',
    "auditNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProcedureAppointment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RatePlanPackageLine_ratePlanId_revenueCodeId_key" ON "RatePlanPackageLine"("ratePlanId", "revenueCodeId");
CREATE INDEX "RatePlanPackageLine_ratePlanId_idx" ON "RatePlanPackageLine"("ratePlanId");
CREATE UNIQUE INDEX "ProcedureService_code_key" ON "ProcedureService"("code");
CREATE INDEX "ProcedureAppointment_reservationId_idx" ON "ProcedureAppointment"("reservationId");
CREATE INDEX "ProcedureAppointment_startAt_endAt_idx" ON "ProcedureAppointment"("startAt", "endAt");
CREATE INDEX "ProcedureAppointment_staffName_startAt_idx" ON "ProcedureAppointment"("staffName", "startAt");
CREATE INDEX "ProcedureAppointment_placeCode_startAt_idx" ON "ProcedureAppointment"("placeCode", "startAt");

ALTER TABLE "RatePlanPackageLine" ADD CONSTRAINT "RatePlanPackageLine_ratePlanId_fkey" FOREIGN KEY ("ratePlanId") REFERENCES "RatePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RatePlanPackageLine" ADD CONSTRAINT "RatePlanPackageLine_revenueCodeId_fkey" FOREIGN KEY ("revenueCodeId") REFERENCES "RevenueCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RatePlanProcedureInclusion" ADD CONSTRAINT "RatePlanProcedureInclusion_ratePlanId_fkey" FOREIGN KEY ("ratePlanId") REFERENCES "RatePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RatePlanProcedureInclusion" ADD CONSTRAINT "RatePlanProcedureInclusion_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "ProcedureService"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProcedureAppointment" ADD CONSTRAINT "ProcedureAppointment_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProcedureAppointment" ADD CONSTRAINT "ProcedureAppointment_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "ProcedureService"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
