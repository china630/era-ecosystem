-- W3 ARI queue + W6 IBE holds

CREATE TABLE IF NOT EXISTS "ChannelAriJob" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "payloadJson" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "notBefore" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChannelAriJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ChannelAriJob_organizationId_status_notBefore_idx"
  ON "ChannelAriJob"("organizationId", "status", "notBefore");
CREATE INDEX IF NOT EXISTS "ChannelAriJob_organizationId_payloadHash_idx"
  ON "ChannelAriJob"("organizationId", "payloadHash");

CREATE TABLE IF NOT EXISTS "IbeHold" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "roomTypeId" TEXT NOT NULL,
  "ratePlanId" TEXT NOT NULL,
  "checkInDate" DATE NOT NULL,
  "checkOutDate" DATE NOT NULL,
  "adults" INTEGER NOT NULL DEFAULT 1,
  "children" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IbeHold_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "IbeHold_organizationId_status_expiresAt_idx"
  ON "IbeHold"("organizationId", "status", "expiresAt");
