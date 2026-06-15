-- Import PO + payment terms (WS-FX-01 / WS-CAL-01)
ALTER TABLE "B2BOrder" ADD COLUMN IF NOT EXISTS "paymentTermDays" INTEGER;
ALTER TABLE "B2BOrder" ADD COLUMN IF NOT EXISTS "dueDate" DATE;

CREATE TYPE "ImportPurchaseOrderStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'CANCELLED');

CREATE TABLE IF NOT EXISTS "ImportPurchaseOrder" (
  "id" TEXT NOT NULL,
  "externalRef" TEXT NOT NULL,
  "supplierCounterpartyId" TEXT,
  "supplierVoen" TEXT,
  "currencyCode" TEXT NOT NULL DEFAULT 'USD',
  "amountForeign" DECIMAL(12,2) NOT NULL,
  "paymentTermDays" INTEGER NOT NULL DEFAULT 30,
  "dueDate" DATE,
  "status" "ImportPurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
  "financePurchaseRef" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "confirmedAt" TIMESTAMP(3),
  CONSTRAINT "ImportPurchaseOrder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ImportPurchaseOrder_externalRef_key" ON "ImportPurchaseOrder"("externalRef");

CREATE TABLE IF NOT EXISTS "ImportPurchaseOrderLine" (
  "id" TEXT NOT NULL,
  "importOrderId" TEXT NOT NULL,
  "sku" TEXT NOT NULL,
  "quantity" DECIMAL(12,3) NOT NULL,
  "unitPriceForeign" DECIMAL(12,2),
  CONSTRAINT "ImportPurchaseOrderLine_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ImportPurchaseOrderLine_importOrderId_fkey" FOREIGN KEY ("importOrderId") REFERENCES "ImportPurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ImportPurchaseOrderLine_importOrderId_idx" ON "ImportPurchaseOrderLine"("importOrderId");
