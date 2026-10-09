CREATE TABLE "HkConsumptionReversal" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "openLineId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HkConsumptionReversal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HkConsumptionReversal_sourceId_key" ON "HkConsumptionReversal"("sourceId");

CREATE INDEX "HkConsumptionReversal_organizationId_openLineId_idx" ON "HkConsumptionReversal"("organizationId", "openLineId");

ALTER TABLE "HkConsumptionReversal" ADD CONSTRAINT "HkConsumptionReversal_openLineId_fkey" FOREIGN KEY ("openLineId") REFERENCES "HkConsumption"("id") ON DELETE CASCADE ON UPDATE CASCADE;
