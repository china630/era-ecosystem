-- Desk quick-create stores a phone on the agency. Commission and settlement stay on the master screen.
ALTER TABLE "Agency" ADD COLUMN IF NOT EXISTS "phone" TEXT;
