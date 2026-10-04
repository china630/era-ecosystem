-- Price history for ServiceCatalogCache and the real ICD-10 load origin.

ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "icd10_source" TEXT;

CREATE TABLE IF NOT EXISTS "service_catalog_price" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "catalog_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "list_amount" DECIMAL(12,2),
    "effective_from" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "service_catalog_price_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "service_catalog_price_organizationId_code_effective_from_idx"
    ON "service_catalog_price"("organizationId", "code", "effective_from");

CREATE INDEX IF NOT EXISTS "service_catalog_price_catalog_id_effective_from_idx"
    ON "service_catalog_price"("catalog_id", "effective_from");

ALTER TABLE "service_catalog_price"
    DROP CONSTRAINT IF EXISTS "service_catalog_price_catalog_id_fkey";

ALTER TABLE "service_catalog_price"
    ADD CONSTRAINT "service_catalog_price_catalog_id_fkey"
    FOREIGN KEY ("catalog_id") REFERENCES "ServiceCatalogCache"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "service_catalog_price" (
    "id",
    "organizationId",
    "catalog_id",
    "code",
    "amount",
    "list_amount",
    "effective_from",
    "created_at"
)
SELECT
    'prc_' || md5(c."id" || clock_timestamp()::text || random()::text),
    c."organizationId",
    c."id",
    c."code",
    c."amount",
    c."list_amount",
    c."syncedAt",
    c."syncedAt"
FROM "ServiceCatalogCache" c
WHERE NOT EXISTS (
    SELECT 1 FROM "service_catalog_price" p WHERE p."catalog_id" = c."id"
);
