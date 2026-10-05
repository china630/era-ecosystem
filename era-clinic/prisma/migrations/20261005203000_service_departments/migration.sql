-- Department cards. Distinct catalog labels stay distinct departments.
-- Cyrillic labels land in name_ru; other labels land in name_az.

CREATE TABLE "service_department" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name_az" TEXT,
    "name_ru" TEXT,
    "name_en" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "service_department_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "service_department_organizationId_code_key"
    ON "service_department"("organizationId", "code");

CREATE INDEX "service_department_organizationId_idx"
    ON "service_department"("organizationId");

INSERT INTO "service_department" (
    "id",
    "organizationId",
    "code",
    "name_az",
    "name_ru",
    "created_at",
    "updated_at"
)
SELECT
    'dept_' || substr(md5("organizationId" || '|' || btrim(department)), 1, 24),
    "organizationId",
    'DEPT-' || upper(substr(md5(btrim(department)), 1, 10)),
    CASE
        WHEN btrim(department) ~ '[А-Яа-яЁё]' THEN NULL
        ELSE btrim(department)
    END,
    CASE
        WHEN btrim(department) ~ '[А-Яа-яЁё]' THEN btrim(department)
        ELSE NULL
    END,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM (
    SELECT DISTINCT "organizationId", department
    FROM "ServiceCatalogCache"
    WHERE department IS NOT NULL AND btrim(department) <> ''
) AS src;

ALTER TABLE "ServiceCatalogCache" ADD COLUMN "department_code" TEXT;

UPDATE "ServiceCatalogCache" AS cache
SET "department_code" = dept.code
FROM "service_department" AS dept
WHERE dept."organizationId" = cache."organizationId"
  AND (
    dept.name_az = btrim(cache.department)
    OR dept.name_ru = btrim(cache.department)
  );

CREATE INDEX "ServiceCatalogCache_organizationId_department_code_idx"
    ON "ServiceCatalogCache"("organizationId", "department_code");

ALTER TABLE "ServiceCatalogCache"
    ADD CONSTRAINT "ServiceCatalogCache_department_fkey"
    FOREIGN KEY ("organizationId", "department_code")
    REFERENCES "service_department"("organizationId", "code")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
