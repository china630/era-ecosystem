ALTER TABLE "FolioCharge" ADD COLUMN "stock_qty" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "FolioCharge" ADD COLUMN "warehouse_code" TEXT;

UPDATE "FolioCharge"
SET "stock_qty" = "qty"
WHERE ("externalRef" IS NULL OR "externalRef" NOT LIKE 'house-use:%')
  AND "adjustsChargeId" IS NULL;

UPDATE "FolioCharge"
SET "stock_qty" = 0
WHERE "externalRef" LIKE 'house-use:%'
   OR "adjustsChargeId" IS NOT NULL;

CREATE TABLE "InternalConsumption" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "businessDate" DATE NOT NULL,
    "sku" TEXT NOT NULL,
    "qty" DECIMAL(14,4) NOT NULL,
    "warehouse_code" TEXT,
    "source" TEXT NOT NULL,
    "source_ref" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InternalConsumption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InternalConsumption_source_ref_key" ON "InternalConsumption"("source_ref");
CREATE INDEX "InternalConsumption_organizationId_businessDate_idx" ON "InternalConsumption"("organizationId", "businessDate");
