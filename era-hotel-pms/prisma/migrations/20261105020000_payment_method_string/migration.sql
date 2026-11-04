-- Payment method codes come from the org catalog (orchestrator). Store as text.
ALTER TABLE "Reservation" ALTER COLUMN "paymentMethod" TYPE TEXT USING ("paymentMethod"::text);
ALTER TABLE "FolioPayment" ALTER COLUMN "paymentMethod" TYPE TEXT USING ("paymentMethod"::text);
ALTER TABLE "GuestDebtPayment" ALTER COLUMN "paymentMethod" TYPE TEXT USING ("paymentMethod"::text);
ALTER TABLE "FolioDeposit" ALTER COLUMN "paymentMethod" TYPE TEXT USING ("paymentMethod"::text);
