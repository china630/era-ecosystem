-- Nafta P4 — B2B sales contracts + MICE event order extensions

-- CreateEnum
CREATE TYPE "SalesContractStatus" AS ENUM ('DRAFT', 'ACTIVE', 'EXPIRED', 'CANCELLED');
CREATE TYPE "SalesContractCounterpartyType" AS ENUM ('AGENCY', 'CORPORATE');
CREATE TYPE "EventOrderLineKind" AS ENUM ('MENU', 'EQUIPMENT', 'STAFF', 'ROOM_RENTAL', 'OTHER');
CREATE TYPE "EventStaffAssignmentStatus" AS ENUM ('PLANNED', 'DONE', 'CANCELLED');

-- CreateTable
CREATE TABLE "SalesContract" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "counterpartyType" "SalesContractCounterpartyType" NOT NULL DEFAULT 'AGENCY',
    "agencyId" TEXT,
    "companyGuestId" TEXT,
    "validFrom" DATE NOT NULL,
    "validTo" DATE,
    "status" "SalesContractStatus" NOT NULL DEFAULT 'DRAFT',
    "ratePlanId" TEXT NOT NULL,
    "minStay" INTEGER,
    "cta" BOOLEAN NOT NULL DEFAULT false,
    "ctd" BOOLEAN NOT NULL DEFAULT false,
    "commissionPercent" DECIMAL(5,2),
    "depositRequired" BOOLEAN NOT NULL DEFAULT false,
    "depositAmount" DECIMAL(12,2),
    "notes" TEXT,
    "externalRef" TEXT,
    "legacyRuleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesContract_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContractAllotment" (
    "id" TEXT NOT NULL,
    "salesContractId" TEXT NOT NULL,
    "roomTypeId" TEXT NOT NULL,
    "validFrom" DATE NOT NULL,
    "validTo" DATE NOT NULL,
    "nightlyQuota" INTEGER NOT NULL,
    "releaseDays" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractAllotment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EventOrderLine" (
    "id" TEXT NOT NULL,
    "banquetEventId" TEXT NOT NULL,
    "kind" "EventOrderLineKind" NOT NULL DEFAULT 'OTHER',
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "revenueCodeId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventOrderLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EventResourceBooking" (
    "id" TEXT NOT NULL,
    "banquetEventId" TEXT NOT NULL,
    "saloonId" TEXT,
    "posResourceId" TEXT,
    "label" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventResourceBooking_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EventStaffAssignment" (
    "id" TEXT NOT NULL,
    "banquetEventId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "staffName" TEXT NOT NULL,
    "shiftStart" TIMESTAMP(3),
    "shiftEnd" TIMESTAMP(3),
    "status" "EventStaffAssignmentStatus" NOT NULL DEFAULT 'PLANNED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventStaffAssignment_pkey" PRIMARY KEY ("id")
);

-- AlterTable BanquetEvent
ALTER TABLE "BanquetEvent" ADD COLUMN "reservationGroupId" TEXT;
ALTER TABLE "BanquetEvent" ADD COLUMN "salesContractId" TEXT;
ALTER TABLE "BanquetEvent" ADD COLUMN "agencyId" TEXT;
ALTER TABLE "BanquetEvent" ADD COLUMN "companyGuestId" TEXT;
ALTER TABLE "BanquetEvent" ADD COLUMN "masterFolioId" TEXT;
ALTER TABLE "BanquetEvent" ADD COLUMN "plannedRevenue" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "BanquetEvent" ADD COLUMN "actualRevenue" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable Reservation
ALTER TABLE "Reservation" ADD COLUMN "salesContractId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "SalesContract_code_key" ON "SalesContract"("code");
CREATE UNIQUE INDEX "SalesContract_legacyRuleId_key" ON "SalesContract"("legacyRuleId");
CREATE INDEX "SalesContract_agencyId_status_idx" ON "SalesContract"("agencyId", "status");
CREATE INDEX "SalesContract_validFrom_validTo_idx" ON "SalesContract"("validFrom", "validTo");
CREATE INDEX "ContractAllotment_salesContractId_roomTypeId_idx" ON "ContractAllotment"("salesContractId", "roomTypeId");
CREATE INDEX "ContractAllotment_validFrom_validTo_idx" ON "ContractAllotment"("validFrom", "validTo");
CREATE INDEX "EventOrderLine_banquetEventId_idx" ON "EventOrderLine"("banquetEventId");
CREATE INDEX "EventResourceBooking_banquetEventId_idx" ON "EventResourceBooking"("banquetEventId");
CREATE INDEX "EventResourceBooking_saloonId_startAt_idx" ON "EventResourceBooking"("saloonId", "startAt");
CREATE INDEX "EventResourceBooking_posResourceId_startAt_idx" ON "EventResourceBooking"("posResourceId", "startAt");
CREATE INDEX "EventStaffAssignment_banquetEventId_idx" ON "EventStaffAssignment"("banquetEventId");
CREATE INDEX "BanquetEvent_salesContractId_idx" ON "BanquetEvent"("salesContractId");
CREATE INDEX "BanquetEvent_agencyId_idx" ON "BanquetEvent"("agencyId");
CREATE INDEX "Reservation_salesContractId_idx" ON "Reservation"("salesContractId");

-- AddForeignKey
ALTER TABLE "SalesContract" ADD CONSTRAINT "SalesContract_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SalesContract" ADD CONSTRAINT "SalesContract_companyGuestId_fkey" FOREIGN KEY ("companyGuestId") REFERENCES "Guest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SalesContract" ADD CONSTRAINT "SalesContract_ratePlanId_fkey" FOREIGN KEY ("ratePlanId") REFERENCES "RatePlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ContractAllotment" ADD CONSTRAINT "ContractAllotment_salesContractId_fkey" FOREIGN KEY ("salesContractId") REFERENCES "SalesContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContractAllotment" ADD CONSTRAINT "ContractAllotment_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_salesContractId_fkey" FOREIGN KEY ("salesContractId") REFERENCES "SalesContract"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BanquetEvent" ADD CONSTRAINT "BanquetEvent_reservationGroupId_fkey" FOREIGN KEY ("reservationGroupId") REFERENCES "ReservationGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BanquetEvent" ADD CONSTRAINT "BanquetEvent_salesContractId_fkey" FOREIGN KEY ("salesContractId") REFERENCES "SalesContract"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BanquetEvent" ADD CONSTRAINT "BanquetEvent_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BanquetEvent" ADD CONSTRAINT "BanquetEvent_companyGuestId_fkey" FOREIGN KEY ("companyGuestId") REFERENCES "Guest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EventOrderLine" ADD CONSTRAINT "EventOrderLine_banquetEventId_fkey" FOREIGN KEY ("banquetEventId") REFERENCES "BanquetEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventOrderLine" ADD CONSTRAINT "EventOrderLine_revenueCodeId_fkey" FOREIGN KEY ("revenueCodeId") REFERENCES "RevenueCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EventResourceBooking" ADD CONSTRAINT "EventResourceBooking_banquetEventId_fkey" FOREIGN KEY ("banquetEventId") REFERENCES "BanquetEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventResourceBooking" ADD CONSTRAINT "EventResourceBooking_saloonId_fkey" FOREIGN KEY ("saloonId") REFERENCES "BanquetSaloon"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EventResourceBooking" ADD CONSTRAINT "EventResourceBooking_posResourceId_fkey" FOREIGN KEY ("posResourceId") REFERENCES "PosResource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EventStaffAssignment" ADD CONSTRAINT "EventStaffAssignment_banquetEventId_fkey" FOREIGN KEY ("banquetEventId") REFERENCES "BanquetEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
