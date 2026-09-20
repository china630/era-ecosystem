-- Unique CM lookup keys + ARI job kind / stale PROCESSING reclaim

ALTER TABLE "ChannelManagerBinding"
  ADD CONSTRAINT "ChannelManagerBinding_channexPropertyId_key" UNIQUE ("channexPropertyId");

ALTER TABLE "ChannelManagerBinding"
  ADD CONSTRAINT "ChannelManagerBinding_ibePublishableKey_key" UNIQUE ("ibePublishableKey");

ALTER TABLE "ChannelAriJob"
  ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'AVAILABILITY';

ALTER TABLE "ChannelAriJob"
  ADD COLUMN IF NOT EXISTS "processingStartedAt" TIMESTAMP(3);

DROP INDEX IF EXISTS "ChannelAriJob_organizationId_payloadHash_idx";

CREATE INDEX IF NOT EXISTS "ChannelAriJob_organizationId_kind_payloadHash_idx"
  ON "ChannelAriJob"("organizationId", "kind", "payloadHash");
