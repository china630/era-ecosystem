-- Pilot polish: editable agency name prefix → PKG-* medical SKU
CREATE TABLE IF NOT EXISTS "AgencyMedicalSkuRule" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "agencyNamePrefix" TEXT NOT NULL,
  "packageCode" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgencyMedicalSkuRule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AgencyMedicalSkuRule_organizationId_active_idx"
  ON "AgencyMedicalSkuRule"("organizationId", "active");
CREATE INDEX IF NOT EXISTS "AgencyMedicalSkuRule_agencyNamePrefix_idx"
  ON "AgencyMedicalSkuRule"("agencyNamePrefix");
