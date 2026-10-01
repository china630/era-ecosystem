-- Nafta appliance (tenant code default) is sanatorium-only.
-- Drops the seeded outpatient + inpatient_day mix so the hospital desk stays closed.

UPDATE "Tenant"
SET "enabled_presets" = ARRAY['sanatorium_clinical']::text[]
WHERE code = 'default'
  AND 'sanatorium_clinical' = ANY("enabled_presets");
