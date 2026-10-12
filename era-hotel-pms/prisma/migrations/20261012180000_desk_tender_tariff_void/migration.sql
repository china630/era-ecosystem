-- Desk tenders, tariff vs actual night price, and voided folio payments.
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'EPOINT';
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'CL_AGENCY';
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'CL_COMPANY';

ALTER TABLE "ReservationDailyRate" ADD COLUMN IF NOT EXISTS "tariffAmount" DECIMAL(12,2);

ALTER TABLE "FolioPayment" ADD COLUMN IF NOT EXISTS "voidedAt" TIMESTAMP(3);
ALTER TABLE "FolioPayment" ADD COLUMN IF NOT EXISTS "voidReason" TEXT;
