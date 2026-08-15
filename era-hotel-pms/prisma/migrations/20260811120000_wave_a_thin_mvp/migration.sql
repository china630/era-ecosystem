-- Stay-level folio routing overrides
CREATE TABLE IF NOT EXISTS "ReservationFolioRoutingOverride" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "revenueCodeId" TEXT NOT NULL,
    "targetFolioType" "FolioType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ReservationFolioRoutingOverride_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ReservationFolioRoutingOverride_reservationId_revenueCodeId_key"
  ON "ReservationFolioRoutingOverride"("reservationId", "revenueCodeId");
CREATE INDEX IF NOT EXISTS "ReservationFolioRoutingOverride_reservationId_idx"
  ON "ReservationFolioRoutingOverride"("reservationId");

DO $$ BEGIN
  ALTER TABLE "ReservationFolioRoutingOverride"
    ADD CONSTRAINT "ReservationFolioRoutingOverride_reservationId_fkey"
    FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ReservationFolioRoutingOverride"
    ADD CONSTRAINT "ReservationFolioRoutingOverride_revenueCodeId_fkey"
    FOREIGN KEY ("revenueCodeId") REFERENCES "RevenueCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- BANK / wire ops tender
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'BANK_TRANSFER';

ALTER TABLE "FolioPayment" ADD COLUMN IF NOT EXISTS "bankReference" TEXT;
