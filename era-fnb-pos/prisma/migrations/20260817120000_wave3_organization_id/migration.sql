-- Wave 3: additive organizationId on Ticket
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';

CREATE TABLE IF NOT EXISTS "_era_organization_bind" (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  "organizationId" TEXT NOT NULL,
  "boundAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "boundBy" TEXT
);

UPDATE "tickets" t
SET "organization_id" = COALESCE(
  (SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1),
  t."organization_id"
)
WHERE t."organization_id" = 'unbound';

CREATE INDEX IF NOT EXISTS "tickets_organization_id_status_idx" ON "tickets"("organization_id", "status");
