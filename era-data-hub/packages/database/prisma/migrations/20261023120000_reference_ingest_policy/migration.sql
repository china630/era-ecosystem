-- CreateEnum
CREATE TYPE "ReferenceCatalogKind" AS ENUM ('FX', 'BANKS', 'COMPANIES', 'HS', 'GEO', 'UOM', 'CURRENCIES', 'TAX_RATES', 'CHART_OF_ACCOUNTS', 'CALENDAR');

-- CreateTable
CREATE TABLE "reference_ingest_policies" (
    "catalog_kind" "ReferenceCatalogKind" NOT NULL,
    "external_fetch_enabled" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reference_ingest_policies_pkey" PRIMARY KEY ("catalog_kind")
);

CREATE TABLE "hub_platform_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hub_platform_settings_pkey" PRIMARY KEY ("key")
);

INSERT INTO "reference_ingest_policies" ("catalog_kind", "external_fetch_enabled", "updated_at") VALUES
    ('FX', true, CURRENT_TIMESTAMP),
    ('BANKS', false, CURRENT_TIMESTAMP),
    ('COMPANIES', false, CURRENT_TIMESTAMP),
    ('HS', false, CURRENT_TIMESTAMP),
    ('GEO', false, CURRENT_TIMESTAMP),
    ('UOM', false, CURRENT_TIMESTAMP),
    ('CURRENCIES', false, CURRENT_TIMESTAMP),
    ('TAX_RATES', false, CURRENT_TIMESTAMP),
    ('CHART_OF_ACCOUNTS', false, CURRENT_TIMESTAMP),
    ('CALENDAR', false, CURRENT_TIMESTAMP);

INSERT INTO "hub_platform_settings" ("key", "value", "updated_at") VALUES
    ('fx.dashboard_currency_codes', '["USD","EUR","GBP","RUB","TRY","CNY","JPY"]', CURRENT_TIMESTAMP),
    ('fx.cbar_check_currency_codes', '["USD","EUR"]', CURRENT_TIMESTAMP);
