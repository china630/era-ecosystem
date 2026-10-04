ALTER TABLE "Housekeeper" ADD COLUMN "globalPersonId" TEXT;

CREATE UNIQUE INDEX "Housekeeper_organizationId_globalPersonId_key" ON "Housekeeper"("organizationId", "globalPersonId");
