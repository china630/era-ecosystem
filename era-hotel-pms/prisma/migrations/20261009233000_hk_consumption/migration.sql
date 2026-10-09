CREATE TABLE "HkConsumption" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "businessDate" DATE NOT NULL,
    "sku" TEXT NOT NULL,
    "qty" DECIMAL(14,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HkConsumption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HkConsumption_organizationId_businessDate_sku_key" ON "HkConsumption"("organizationId", "businessDate", "sku");
CREATE INDEX "HkConsumption_organizationId_businessDate_idx" ON "HkConsumption"("organizationId", "businessDate");
