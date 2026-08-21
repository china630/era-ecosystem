-- HOT-AGP-03: passport scan metadata on reservation attachments
ALTER TABLE "ReservationAttachment" ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'OTHER';
ALTER TABLE "ReservationAttachment" ADD COLUMN IF NOT EXISTS "storageKey" TEXT;
CREATE INDEX IF NOT EXISTS "ReservationAttachment_kind_idx" ON "ReservationAttachment"("kind");
