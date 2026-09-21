-- F3: bind fiscal KKM / bank POS to clinic cashier shift
ALTER TABLE "ClinicShift" ADD COLUMN IF NOT EXISTS "fiscal_device_id" TEXT;
ALTER TABLE "ClinicShift" ADD COLUMN IF NOT EXISTS "bank_terminal_id" TEXT;
