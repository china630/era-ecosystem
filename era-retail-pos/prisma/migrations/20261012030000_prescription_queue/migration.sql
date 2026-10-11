CREATE TYPE "PrescriptionQueueStatus" AS ENUM ('AWAITING_PAY', 'READY', 'DISPENSED', 'RETURNED');

CREATE TABLE IF NOT EXISTS "PrescriptionQueue" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "visitId" TEXT NOT NULL,
  "patientRef" TEXT NOT NULL,
  "patientOrigin" TEXT NOT NULL,
  "reservationId" TEXT,
  "linesJson" TEXT NOT NULL,
  "status" "PrescriptionQueueStatus" NOT NULL DEFAULT 'AWAITING_PAY',
  "paidAt" TIMESTAMP(3),
  "dispensedAt" TIMESTAMP(3),
  "returnedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PrescriptionQueue_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PrescriptionQueue_organizationId_status_idx" ON "PrescriptionQueue"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "PrescriptionQueue_visitId_idx" ON "PrescriptionQueue"("visitId");

CREATE TABLE IF NOT EXISTS "ProductPrice" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "unitPrice" DECIMAL(12,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductPrice_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProductPrice_organizationId_productId_createdAt_idx"
  ON "ProductPrice"("organizationId", "productId", "createdAt");
