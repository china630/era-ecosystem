-- Clinic scheduling time layers: per-type cabin idle + guest rest
-- ADR: docs/adr/clinic-scheduling-time-layers.md
ALTER TABLE "ProcedureType" ADD COLUMN IF NOT EXISTS "resource_gap_minutes" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "ProcedureType" ADD COLUMN IF NOT EXISTS "patient_rest_minutes" INTEGER NOT NULL DEFAULT 15;
