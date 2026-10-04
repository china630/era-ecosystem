-- Agency medical package lives on the agency. Prefix rules are folded in, then dropped.
ALTER TABLE "Agency" ADD COLUMN IF NOT EXISTS "medicalPackageCode" TEXT;

UPDATE "Agency" a
SET "medicalPackageCode" = sub.code
FROM (
  SELECT DISTINCT ON (a2.id) a2.id, r."packageCode" AS code
  FROM "Agency" a2
  JOIN "AgencyMedicalSkuRule" r
    ON r."organizationId" = a2."organizationId"
   AND r.active = true
   AND (
     lower(a2.name) LIKE lower(r."agencyNamePrefix") || '%'
     OR lower(a2.name) LIKE '%' || lower(r."agencyNamePrefix") || '%'
   )
  ORDER BY a2.id, length(r."agencyNamePrefix") DESC
) sub
WHERE a.id = sub.id
  AND a."medicalPackageCode" IS NULL;

DROP TABLE IF EXISTS "AgencyMedicalSkuRule";

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "positionTitle" TEXT;

CREATE TABLE IF NOT EXISTS "UserLogin" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "login" TEXT NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserLogin_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "UserLogin_organizationId_createdAt_idx" ON "UserLogin"("organizationId", "createdAt");
CREATE INDEX IF NOT EXISTS "UserLogin_userId_idx" ON "UserLogin"("userId");

DO $$ BEGIN
  ALTER TABLE "UserLogin"
    ADD CONSTRAINT "UserLogin_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
