-- Repay a personal guest debt left at checkout. The original entry stays; payments reduce the balance.
CREATE TABLE IF NOT EXISTS "GuestDebtPayment" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "entryId" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "paymentMethod" "PaymentMethod" NOT NULL,
  "bankTerminalId" TEXT,
  "created_by_user_id" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GuestDebtPayment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GuestDebtPayment_organizationId_entryId_idx"
  ON "GuestDebtPayment"("organizationId", "entryId");

CREATE INDEX IF NOT EXISTS "GuestDebtPayment_createdAt_idx"
  ON "GuestDebtPayment"("createdAt");

DO $$ BEGIN
  ALTER TABLE "GuestDebtPayment"
    ADD CONSTRAINT "GuestDebtPayment_entryId_fkey"
    FOREIGN KEY ("entryId") REFERENCES "GuestDebtEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
