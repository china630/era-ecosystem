-- F3: bind fiscal KKM / bank POS to retail shift
ALTER TABLE "Shift" ADD COLUMN IF NOT EXISTS "fiscal_device_id" TEXT;
ALTER TABLE "Shift" ADD COLUMN IF NOT EXISTS "bank_terminal_id" TEXT;
