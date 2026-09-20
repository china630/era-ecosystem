-- F3: bind fiscal KKM / bank POS to POS shift
ALTER TABLE "pos_shifts" ADD COLUMN IF NOT EXISTS "fiscal_device_id" TEXT;
ALTER TABLE "pos_shifts" ADD COLUMN IF NOT EXISTS "bank_terminal_id" TEXT;
