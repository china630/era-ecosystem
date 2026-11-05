-- Satellite integration channels (CP-CHANNELS-01)
CREATE TYPE "SatelliteChannelKind" AS ENUM ('FOLIO_POST', 'SETTLEMENT', 'REVENUE_EVENT', 'READ_STATUS');
CREATE TYPE "SatelliteChannelManagedBy" AS ENUM ('PLATFORM', 'ACCEPTOR');

CREATE TABLE "organization_satellite_channels" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "from_org_id" UUID NOT NULL,
  "from_satellite_key" TEXT NOT NULL,
  "to_org_id" UUID NOT NULL,
  "to_satellite_key" TEXT NOT NULL,
  "kind" "SatelliteChannelKind" NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "managed_by" "SatelliteChannelManagedBy" NOT NULL DEFAULT 'PLATFORM',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "organization_satellite_channels_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "organization_satellite_channels_identity_key"
  ON "organization_satellite_channels" ("from_org_id", "from_satellite_key", "to_org_id", "to_satellite_key", "kind");
CREATE INDEX "organization_satellite_channels_from_idx" ON "organization_satellite_channels" ("from_org_id", "from_satellite_key");
CREATE INDEX "organization_satellite_channels_to_idx" ON "organization_satellite_channels" ("to_org_id", "to_satellite_key");

ALTER TABLE "organization_satellite_channels"
  ADD CONSTRAINT "organization_satellite_channels_from_org_id_fkey"
  FOREIGN KEY ("from_org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "organization_satellite_channels"
  ADD CONSTRAINT "organization_satellite_channels_to_org_id_fkey"
  FOREIGN KEY ("to_org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
