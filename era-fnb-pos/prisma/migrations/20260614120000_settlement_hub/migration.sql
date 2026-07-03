-- Settlement hub defer: ticket awaits hotel Front Cash payment

ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'PENDING_HUB';

ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "settlement_pending_id" TEXT;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "hub_fiscal_receipt_id" TEXT;
