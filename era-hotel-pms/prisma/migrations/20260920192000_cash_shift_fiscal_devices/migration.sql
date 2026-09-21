-- F3: bind fiscal KKM / bank POS to hotel cash shift
ALTER TABLE "CashShift" ADD COLUMN IF NOT EXISTS "fiscalDeviceId" TEXT;
ALTER TABLE "CashShift" ADD COLUMN IF NOT EXISTS "bankTerminalId" TEXT;
