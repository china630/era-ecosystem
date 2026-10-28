-- Agency commission payable (hotel → agency). Not City Ledger AR.

CREATE TYPE "AgencyCommissionLineStatus" AS ENUM (
  'ACCRUED',
  'READY',
  'IN_PAYMENT',
  'PAID',
  'ON_HOLD',
  'DISPUTED',
  'VOID',
  'SKIPPED_NET'
);

CREATE TYPE "AgencyCommissionBatchStatus" AS ENUM (
  'DRAFT',
  'SUBMITTED',
  'PAID',
  'CANCELLED'
);

CREATE TABLE "AgencyCommissionBatch" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "agencyId" TEXT NOT NULL,
  "periodFrom" DATE NOT NULL,
  "periodTo" DATE NOT NULL,
  "totalAmount" DECIMAL(12,2) NOT NULL,
  "status" "AgencyCommissionBatchStatus" NOT NULL DEFAULT 'DRAFT',
  "correlationId" TEXT,
  "financePayableId" TEXT,
  "submittedAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AgencyCommissionBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgencyCommissionLine" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "agencyId" TEXT NOT NULL,
  "reservationId" TEXT NOT NULL,
  "commercialPeriodId" TEXT,
  "periodKey" TEXT NOT NULL,
  "fromDate" DATE NOT NULL,
  "toDate" DATE NOT NULL,
  "revenueBase" DECIMAL(12,2) NOT NULL,
  "commissionPercent" DECIMAL(5,2) NOT NULL,
  "commissionBasis" "CommissionBasis" NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'AZN',
  "status" "AgencyCommissionLineStatus" NOT NULL DEFAULT 'ACCRUED',
  "batchId" TEXT,
  "financePayableId" TEXT,
  "paidAt" TIMESTAMP(3),
  "holdReason" TEXT,
  "disputedReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AgencyCommissionLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AgencyCommissionLine_organizationId_reservationId_periodKey_key"
  ON "AgencyCommissionLine"("organizationId", "reservationId", "periodKey");

CREATE INDEX "AgencyCommissionLine_organizationId_agencyId_status_idx"
  ON "AgencyCommissionLine"("organizationId", "agencyId", "status");

CREATE INDEX "AgencyCommissionLine_organizationId_status_idx"
  ON "AgencyCommissionLine"("organizationId", "status");

CREATE INDEX "AgencyCommissionLine_batchId_idx" ON "AgencyCommissionLine"("batchId");

CREATE INDEX "AgencyCommissionBatch_organizationId_agencyId_status_idx"
  ON "AgencyCommissionBatch"("organizationId", "agencyId", "status");

CREATE INDEX "AgencyCommissionBatch_organizationId_status_idx"
  ON "AgencyCommissionBatch"("organizationId", "status");

ALTER TABLE "AgencyCommissionBatch"
  ADD CONSTRAINT "AgencyCommissionBatch_agencyId_fkey"
  FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AgencyCommissionLine"
  ADD CONSTRAINT "AgencyCommissionLine_agencyId_fkey"
  FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AgencyCommissionLine"
  ADD CONSTRAINT "AgencyCommissionLine_reservationId_fkey"
  FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AgencyCommissionLine"
  ADD CONSTRAINT "AgencyCommissionLine_commercialPeriodId_fkey"
  FOREIGN KEY ("commercialPeriodId") REFERENCES "ReservationCommercialPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AgencyCommissionLine"
  ADD CONSTRAINT "AgencyCommissionLine_batchId_fkey"
  FOREIGN KEY ("batchId") REFERENCES "AgencyCommissionBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
