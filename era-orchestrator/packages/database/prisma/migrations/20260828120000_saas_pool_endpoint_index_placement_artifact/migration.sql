-- Pool membership lookup: orgs sharing a satellite process URL.
CREATE INDEX IF NOT EXISTS "satellite_endpoints_satellite_key_base_url_idx"
  ON "satellite_endpoints" ("satellite_key", "base_url");

-- Placement host-apply artifact fields.
ALTER TABLE "placement_jobs" ADD COLUMN IF NOT EXISTS "artifact_ref" TEXT;
ALTER TABLE "placement_jobs" ADD COLUMN IF NOT EXISTS "artifact_json" JSONB;
ALTER TABLE "placement_jobs" ADD COLUMN IF NOT EXISTS "apply_log" TEXT;
