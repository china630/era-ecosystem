ALTER TABLE "DiagnosticService" ADD COLUMN "package_only" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "DiagnosticCategory" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DiagnosticCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DiagnosticCategory_organizationId_name_key" ON "DiagnosticCategory"("organizationId", "name");
CREATE INDEX "DiagnosticCategory_organizationId_idx" ON "DiagnosticCategory"("organizationId");

INSERT INTO "DiagnosticCategory" ("id", "organizationId", "name", "active", "createdAt", "updatedAt")
SELECT
  'dcat_' || substr(md5("organizationId" || '|' || category), 1, 24),
  "organizationId",
  category,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "DiagnosticService"
WHERE btrim(category) <> ''
GROUP BY "organizationId", category;

UPDATE "DiagnosticService"
SET "package_only" = true
WHERE code IN (
  'LAB-BIOCHEM-DERMA',
  'LAB-BIOCHEM-PREMIUM',
  'LAB-BIOCHEM-STANDART',
  'LAB-BIOCHEM-DETOKS'
);
