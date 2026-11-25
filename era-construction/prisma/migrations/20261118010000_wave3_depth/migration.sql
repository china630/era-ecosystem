-- Wave 3 depth: richer daily log fields.
ALTER TABLE "DailyLog" ADD COLUMN IF NOT EXISTS "equipment_notes" TEXT;
ALTER TABLE "DailyLog" ADD COLUMN IF NOT EXISTS "photo_url" TEXT;
ALTER TABLE "DailyLog" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'DRAFT';
