-- Guest personal debt, fiscal device mirror, payment actor.
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'GUEST_DEBT';

ALTER TABLE "FolioPayment" ADD COLUMN IF NOT EXISTS "created_by_user_id" TEXT;

CREATE TABLE IF NOT EXISTS "GuestDebtEntry" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "reservationId" TEXT NOT NULL,
  "guestId" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "note" TEXT NOT NULL,
  "created_by_user_id" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GuestDebtEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GuestDebtEntry_organizationId_guestId_idx" ON "GuestDebtEntry"("organizationId", "guestId");
CREATE INDEX IF NOT EXISTS "GuestDebtEntry_reservationId_idx" ON "GuestDebtEntry"("reservationId");

CREATE TABLE IF NOT EXISTS "FiscalDeviceMirror" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "outletCode" TEXT,
  "registerCode" TEXT,
  "serial" TEXT,
  "endpoint" TEXT,
  "status" TEXT NOT NULL,
  "isOrgDefault" BOOLEAN NOT NULL DEFAULT false,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FiscalDeviceMirror_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "FiscalDeviceMirror_organizationId_kind_idx" ON "FiscalDeviceMirror"("organizationId", "kind");
