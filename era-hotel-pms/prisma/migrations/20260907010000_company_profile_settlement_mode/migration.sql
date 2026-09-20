-- CreateEnum
CREATE TYPE "B2bSettlementMode" AS ENUM ('PREPAID', 'POSTPAID');

-- AlterTable
ALTER TABLE "Agency" ADD COLUMN "settlementMode" "B2bSettlementMode" NOT NULL DEFAULT 'POSTPAID';

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "voen" TEXT,
    "financeCounterpartyId" TEXT,
    "creditLimitAzn" DECIMAL(12,2),
    "paymentTermsDays" INTEGER,
    "settlementMode" "B2bSettlementMode" NOT NULL DEFAULT 'POSTPAID',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Company_organizationId_code_key" ON "Company"("organizationId", "code");
CREATE INDEX "Company_organizationId_idx" ON "Company"("organizationId");

ALTER TABLE "SalesContract" ADD COLUMN "companyId" TEXT;
ALTER TABLE "Reservation" ADD COLUMN "companyId" TEXT;

CREATE INDEX "SalesContract_companyId_status_idx" ON "SalesContract"("companyId", "status");
CREATE INDEX "Reservation_companyId_idx" ON "Reservation"("companyId");

ALTER TABLE "SalesContract" ADD CONSTRAINT "SalesContract_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
