-- CreateEnum
CREATE TYPE "TourismSubmissionStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');
CREATE TYPE "PosResourceType" AS ENUM ('TABLE', 'SPA_CABIN');
CREATE TYPE "PosReservationStatus" AS ENUM ('BOOKED', 'SEATED', 'CANCELLED', 'COMPLETED');
CREATE TYPE "StockMovementType" AS ENUM ('RECEIPT', 'ISSUE', 'TRANSFER');

-- AlterTable
ALTER TABLE "FolioPayment" ADD COLUMN "fiscalReceiptId" TEXT,
ADD COLUMN "fiscalQrPayload" TEXT;

-- CreateTable
CREATE TABLE "TourismSubmission" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "eventKind" TEXT NOT NULL,
    "status" "TourismSubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "payloadJson" TEXT NOT NULL,
    "errorMessage" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TourismSubmission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PosResource" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "resourceType" "PosResourceType" NOT NULL,
    "outletCode" TEXT NOT NULL DEFAULT 'RESTAURANT',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PosResource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PosReservation" (
    "id" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "reservationId" TEXT,
    "guestName" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "partySize" INTEGER NOT NULL DEFAULT 2,
    "status" "PosReservationStatus" NOT NULL DEFAULT 'BOOKED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PosReservation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Warehouse" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductGroup" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    CONSTRAINT "ProductGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "groupId" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'pcs',
    "barcode" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "qty" DECIMAL(12,3) NOT NULL,
    "reference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Recipe" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RecipeLine" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "ingredientProductId" TEXT NOT NULL,
    "qty" DECIMAL(12,3) NOT NULL,
    CONSTRAINT "RecipeLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TourismSubmission_reservationId_idx" ON "TourismSubmission"("reservationId");
CREATE INDEX "TourismSubmission_status_idx" ON "TourismSubmission"("status");
CREATE UNIQUE INDEX "PosResource_code_key" ON "PosResource"("code");
CREATE INDEX "PosReservation_resourceId_startAt_idx" ON "PosReservation"("resourceId", "startAt");
CREATE UNIQUE INDEX "Warehouse_code_key" ON "Warehouse"("code");
CREATE UNIQUE INDEX "ProductGroup_code_key" ON "ProductGroup"("code");
CREATE UNIQUE INDEX "Product_code_key" ON "Product"("code");
CREATE INDEX "StockMovement_productId_warehouseId_idx" ON "StockMovement"("productId", "warehouseId");
CREATE UNIQUE INDEX "Recipe_productId_key" ON "Recipe"("productId");

-- AddForeignKey
ALTER TABLE "TourismSubmission" ADD CONSTRAINT "TourismSubmission_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PosReservation" ADD CONSTRAINT "PosReservation_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "PosResource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PosReservation" ADD CONSTRAINT "PosReservation_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ProductGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RecipeLine" ADD CONSTRAINT "RecipeLine_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecipeLine" ADD CONSTRAINT "RecipeLine_ingredientProductId_fkey" FOREIGN KEY ("ingredientProductId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Reservation_agencyId_idx" ON "Reservation"("agencyId");
