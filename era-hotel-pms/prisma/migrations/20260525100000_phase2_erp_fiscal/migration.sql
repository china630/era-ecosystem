-- CreateEnum
CREATE TYPE "FiscalDocumentStatus" AS ENUM ('PENDING', 'SENT', 'ACCEPTED', 'REJECTED');

-- CreateTable
CREATE TABLE "FiscalDocument" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "folioId" TEXT,
    "invoiceNumber" TEXT,
    "counterpartyVoen" TEXT,
    "fiscalStatus" "FiscalDocumentStatus" NOT NULL DEFAULT 'PENDING',
    "fiscalExternalId" TEXT,
    "rejectionReason" TEXT,
    "lastEventAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FiscalDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FiscalDocument_reservationId_idx" ON "FiscalDocument"("reservationId");
CREATE INDEX "FiscalDocument_folioId_idx" ON "FiscalDocument"("folioId");
CREATE INDEX "FiscalDocument_fiscalStatus_idx" ON "FiscalDocument"("fiscalStatus");

-- AddForeignKey
ALTER TABLE "FiscalDocument" ADD CONSTRAINT "FiscalDocument_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FiscalDocument" ADD CONSTRAINT "FiscalDocument_folioId_fkey" FOREIGN KEY ("folioId") REFERENCES "Folio"("id") ON DELETE SET NULL ON UPDATE CASCADE;
