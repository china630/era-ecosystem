-- Soft-archive for pricing bundles (no hard delete in admin UI).
ALTER TABLE "pricing_bundles" ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "pricing_bundles_archived_at_idx" ON "pricing_bundles"("archived_at");