-- Wave 5 NW-1: FIN-01 hotel revenue → finance GL mapping
CREATE TABLE "HotelRevenueGlMapping" (
    "id" TEXT NOT NULL,
    "revenueCodeId" TEXT NOT NULL,
    "glAccountCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HotelRevenueGlMapping_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HotelRevenueGlMapping_revenueCodeId_key" ON "HotelRevenueGlMapping"("revenueCodeId");

ALTER TABLE "HotelRevenueGlMapping" ADD CONSTRAINT "HotelRevenueGlMapping_revenueCodeId_fkey" FOREIGN KEY ("revenueCodeId") REFERENCES "RevenueCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
