-- Channel Manager pack W1: org binding + tenant-scope sync journal

CREATE TABLE IF NOT EXISTS "ChannelManagerBinding" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'off',
  "channexPropertyId" TEXT,
  "propertyType" TEXT NOT NULL DEFAULT 'hotel',
  "live" BOOLEAN NOT NULL DEFAULT false,
  "ibePublishableKey" TEXT,
  "ibeAllowedOrigins" JSONB NOT NULL DEFAULT '[]',
  "webhookSecretCipher" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChannelManagerBinding_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ChannelManagerBinding_organizationId_key"
  ON "ChannelManagerBinding"("organizationId");
CREATE INDEX IF NOT EXISTS "ChannelManagerBinding_channexPropertyId_idx"
  ON "ChannelManagerBinding"("channexPropertyId");
CREATE INDEX IF NOT EXISTS "ChannelManagerBinding_ibePublishableKey_idx"
  ON "ChannelManagerBinding"("ibePublishableKey");

ALTER TABLE "ChannelSyncError"
  ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "ChannelSyncError" SET "organizationId" = '' WHERE "organizationId" IS NULL;

ALTER TABLE "ChannelSyncError"
  ALTER COLUMN "organizationId" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "ChannelSyncError_organizationId_idx"
  ON "ChannelSyncError"("organizationId");
CREATE INDEX IF NOT EXISTS "ChannelSyncError_organizationId_status_idx"
  ON "ChannelSyncError"("organizationId", "status");

ALTER TABLE "OutboundEventLog"
  ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

CREATE INDEX IF NOT EXISTS "OutboundEventLog_organizationId_idx"
  ON "OutboundEventLog"("organizationId");
CREATE INDEX IF NOT EXISTS "OutboundEventLog_organizationId_eventType_idx"
  ON "OutboundEventLog"("organizationId", "eventType");
