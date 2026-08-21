-- Wave 3: additive organizationId on clinic hot tables (DEDICATED-safe backfill)
ALTER TABLE "PatientRef" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
ALTER TABLE "Visit" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
ALTER TABLE "LabOrder" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
ALTER TABLE "ProcedureOrder" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';

CREATE TABLE IF NOT EXISTS "_era_organization_bind" (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  "organizationId" TEXT NOT NULL,
  "boundAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "boundBy" TEXT
);

UPDATE "PatientRef" pr
SET "organization_id" = COALESCE(
  (SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1),
  (SELECT ce."organizationId" FROM "ClinicalEpisode" ce WHERE ce."patientRefId" = pr.id LIMIT 1),
  pr."organization_id"
)
WHERE pr."organization_id" = 'unbound';

UPDATE "Appointment" a
SET "organization_id" = COALESCE(
  (SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1),
  (SELECT pr."organization_id" FROM "PatientRef" pr WHERE pr.id = a."patientRefId" LIMIT 1),
  a."organization_id"
)
WHERE a."organization_id" = 'unbound';

UPDATE "Visit" v
SET "organization_id" = COALESCE(
  (SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1),
  (SELECT pr."organization_id" FROM "PatientRef" pr WHERE pr.id = v."patientRefId" LIMIT 1),
  v."organization_id"
)
WHERE v."organization_id" = 'unbound';

UPDATE "LabOrder" lo
SET "organization_id" = COALESCE(
  (SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1),
  (SELECT pr."organization_id" FROM "PatientRef" pr WHERE pr.id = lo."patientRefId" LIMIT 1),
  lo."organization_id"
)
WHERE lo."organization_id" = 'unbound';

UPDATE "ProcedureOrder" po
SET "organization_id" = COALESCE(
  (SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1),
  (SELECT pr."organization_id" FROM "PatientRef" pr WHERE pr.id = po."patientRefId" LIMIT 1),
  po."organization_id"
)
WHERE po."organization_id" = 'unbound';

DROP INDEX IF EXISTS "PatientRef_refCode_key";
CREATE UNIQUE INDEX IF NOT EXISTS "PatientRef_organization_id_refCode_key" ON "PatientRef"("organization_id", "refCode");
CREATE INDEX IF NOT EXISTS "PatientRef_organization_id_idx" ON "PatientRef"("organization_id");
CREATE INDEX IF NOT EXISTS "Appointment_organization_id_scheduledAt_idx" ON "Appointment"("organization_id", "scheduledAt");
CREATE INDEX IF NOT EXISTS "Visit_organization_id_status_idx" ON "Visit"("organization_id", "status");
CREATE INDEX IF NOT EXISTS "LabOrder_organization_id_status_idx" ON "LabOrder"("organization_id", "status");
CREATE INDEX IF NOT EXISTS "ProcedureOrder_organization_id_scheduledAt_idx" ON "ProcedureOrder"("organization_id", "scheduledAt");
