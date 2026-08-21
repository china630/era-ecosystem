-- SHARED-schema remainder: practitioner schedule roots
CREATE TABLE IF NOT EXISTS "_era_organization_bind" (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  "organizationId" TEXT NOT NULL,
  "boundAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "boundBy" TEXT
);

ALTER TABLE "PractitionerScheduleRule" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
UPDATE "PractitionerScheduleRule" t SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), t."organization_id") WHERE t."organization_id" = 'unbound';
CREATE INDEX IF NOT EXISTS "PractitionerScheduleRule_organization_id_idx" ON "PractitionerScheduleRule"("organization_id");

ALTER TABLE "PractitionerScheduleException" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
UPDATE "PractitionerScheduleException" t SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), t."organization_id") WHERE t."organization_id" = 'unbound';
CREATE INDEX IF NOT EXISTS "PractitionerScheduleException_organization_id_idx" ON "PractitionerScheduleException"("organization_id");

ALTER TABLE "practitioner_skill" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
UPDATE "practitioner_skill" t SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), t."organization_id") WHERE t."organization_id" = 'unbound';
CREATE INDEX IF NOT EXISTS "practitioner_skill_organization_id_idx" ON "practitioner_skill"("organization_id");
