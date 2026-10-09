ALTER TABLE "HkConsumption" ADD COLUMN "reversesId" TEXT;

CREATE UNIQUE INDEX "HkConsumption_reversesId_key" ON "HkConsumption"("reversesId");
