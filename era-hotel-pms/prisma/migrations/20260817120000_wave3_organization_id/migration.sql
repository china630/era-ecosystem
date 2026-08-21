-- Wave 3: additive organizationId on hotel hot tables + bind backfill
ALTER TABLE "HotelProfile" ALTER COLUMN "organizationId" SET DEFAULT 'unbound';
UPDATE "HotelProfile" SET "organizationId" = 'unbound' WHERE "organizationId" = 'nafta-sanatorium-org';

ALTER TABLE "Guest" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL DEFAULT 'unbound';
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL DEFAULT 'unbound';
ALTER TABLE "Folio" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL DEFAULT 'unbound';

CREATE TABLE IF NOT EXISTS "_era_organization_bind" (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  "organizationId" TEXT NOT NULL,
  "boundAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "boundBy" TEXT
);

UPDATE "HotelProfile" hp
SET "organizationId" = COALESCE(
  (SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1),
  hp."organizationId"
)
WHERE hp."organizationId" = 'unbound';

UPDATE "Guest" g
SET "organizationId" = COALESCE(
  (SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1),
  g."organizationId"
)
WHERE g."organizationId" = 'unbound';

UPDATE "Reservation" r
SET "organizationId" = COALESCE(
  (SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1),
  (SELECT g."organizationId" FROM "Guest" g WHERE g.id = r."guestId" LIMIT 1),
  r."organizationId"
)
WHERE r."organizationId" = 'unbound';

UPDATE "Folio" f
SET "organizationId" = COALESCE(
  (SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1),
  (SELECT r."organizationId" FROM "Reservation" r WHERE r.id = f."reservationId" LIMIT 1),
  f."organizationId"
)
WHERE f."organizationId" = 'unbound';

CREATE INDEX IF NOT EXISTS "Guest_organizationId_idx" ON "Guest"("organizationId");
CREATE INDEX IF NOT EXISTS "Reservation_organizationId_status_idx" ON "Reservation"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "Folio_organizationId_status_idx" ON "Folio"("organizationId", "status");
