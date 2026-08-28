-- Per-org Elektraweb dual-run policy (SaaS Super-Admin / Sync).
CREATE TABLE IF NOT EXISTS "ElektrawebBridgePolicy" (
  "organizationId" TEXT NOT NULL,
  "inboundEnabled" BOOLEAN NOT NULL DEFAULT false,
  "writeEnabled" BOOLEAN NOT NULL DEFAULT false,
  "elektrawebHotelId" INTEGER,
  "spaDepId" INTEGER,
  "spaCurrencyId" INTEGER,
  "walkinResId" TEXT,
  "walkinResNameId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ElektrawebBridgePolicy_pkey" PRIMARY KEY ("organizationId")
);
