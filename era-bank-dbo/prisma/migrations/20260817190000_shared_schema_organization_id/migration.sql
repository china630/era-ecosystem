-- SHARED-schema: additive organizationId (CP-TENANT-01 / B7). No SHARED bank pool this edition.
CREATE TABLE IF NOT EXISTS "_era_organization_bind" (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  "organizationId" TEXT NOT NULL,
  "boundAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "boundBy" TEXT
);

ALTER TABLE "CustomerSession" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
UPDATE "CustomerSession" t SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), t."organization_id") WHERE t."organization_id" = 'unbound';
CREATE INDEX IF NOT EXISTS "CustomerSession_organization_id_idx" ON "CustomerSession"("organization_id");

ALTER TABLE "CorporateApiKey" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
UPDATE "CorporateApiKey" t SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), t."organization_id") WHERE t."organization_id" = 'unbound';
DROP INDEX IF EXISTS "CorporateApiKey_keyHash_key";
CREATE UNIQUE INDEX IF NOT EXISTS "CorporateApiKey_organization_id_keyHash_key" ON "CorporateApiKey"("organization_id", "keyHash");
CREATE INDEX IF NOT EXISTS "CorporateApiKey_organization_id_idx" ON "CorporateApiKey"("organization_id");

ALTER TABLE "PaymentSignRequest" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
UPDATE "PaymentSignRequest" t SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), t."organization_id") WHERE t."organization_id" = 'unbound';
DROP INDEX IF EXISTS "PaymentSignRequest_engineOrderId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "PaymentSignRequest_organization_id_engineOrderId_key" ON "PaymentSignRequest"("organization_id", "engineOrderId");
CREATE INDEX IF NOT EXISTS "PaymentSignRequest_organization_id_idx" ON "PaymentSignRequest"("organization_id");
