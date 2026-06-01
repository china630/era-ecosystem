-- ERA Data Hub — initial reference schema
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE "CbarRateStatus" AS ENUM ('PRELIMINARY', 'FINAL');
CREATE TYPE "CounterpartyLegalForm" AS ENUM ('LLC', 'JSC', 'INDIVIDUAL_ENTREPRENEUR', 'BRANCH', 'REPRESENTATION', 'OTHER');
CREATE TYPE "UnitOfMeasureKind" AS ENUM ('PIECE', 'WEIGHT', 'LENGTH', 'VOLUME', 'AREA', 'TIME', 'OTHER');
CREATE TYPE "TaxRateKind" AS ENUM ('VAT', 'EXCISE', 'SIMPLIFIED', 'OTHER');

CREATE TABLE "calendar_days" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "country" CHAR(2) NOT NULL DEFAULT 'AZ',
    "date" DATE NOT NULL,
    "is_working" BOOLEAN NOT NULL,
    "day_type" TEXT NOT NULL,
    "label_az" TEXT,
    "label_ru" TEXT,
    "label_en" TEXT,
    "source" TEXT NOT NULL DEFAULT 'era-data-hub',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "calendar_days_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "calendar_days_country_date_key" ON "calendar_days"("country", "date");
CREATE INDEX "calendar_days_country_is_working_idx" ON "calendar_days"("country", "is_working");

CREATE TABLE "cbar_official_rates" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "rate_date" DATE NOT NULL,
    "currency_code" TEXT NOT NULL,
    "value" DECIMAL(19,4) NOT NULL,
    "nominal" INTEGER NOT NULL,
    "rate" DECIMAL(19,8) NOT NULL,
    "status" "CbarRateStatus" NOT NULL DEFAULT 'PRELIMINARY',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "cbar_official_rates_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "cbar_official_rates_rate_date_currency_code_key" ON "cbar_official_rates"("rate_date", "currency_code");

CREATE TABLE "global_company_directory" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "tax_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legal_form" "CounterpartyLegalForm",
    "legal_address" TEXT,
    "phone" TEXT,
    "director_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "global_company_directory_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "global_company_directory_tax_id_key" ON "global_company_directory"("tax_id");

CREATE TABLE "bank_glossary" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name_az" TEXT NOT NULL,
    "voen" TEXT NOT NULL,
    "code" CHAR(2) NOT NULL,
    "correspondent_iban" TEXT,
    "swift" TEXT,
    "head_phones" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "head_address" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "bank_glossary_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "bank_glossary_voen_key" ON "bank_glossary"("voen");
CREATE UNIQUE INDEX "bank_glossary_code_key" ON "bank_glossary"("code");

CREATE TABLE "bank_branches" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "bank_id" UUID NOT NULL,
    "branch_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "swift" TEXT,
    "address" TEXT,
    "phones" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_head_office" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "bank_branches_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "bank_branches_bank_id_fkey" FOREIGN KEY ("bank_id") REFERENCES "bank_glossary"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "bank_branches_bank_id_branch_code_key" ON "bank_branches"("bank_id", "branch_code");

CREATE TABLE "customs_tariff_rates" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "hs_code" TEXT NOT NULL,
    "description" TEXT,
    "duty_rate_percent" DECIMAL(7,4) NOT NULL,
    "vat_rate_percent" DECIMAL(7,4) NOT NULL,
    "excise_percent" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "notes" TEXT,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "customs_tariff_rates_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "customs_tariff_rates_hs_code_effective_from_key" ON "customs_tariff_rates"("hs_code", "effective_from");

CREATE TABLE "units_of_measure" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "code" TEXT NOT NULL,
    "kind" "UnitOfMeasureKind" NOT NULL,
    "base_code" TEXT,
    "factor" DECIMAL(19,6) NOT NULL DEFAULT 1,
    "name_az" TEXT NOT NULL,
    "name_ru" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "units_of_measure_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "units_of_measure_code_key" ON "units_of_measure"("code");

CREATE TABLE "countries" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "iso2" CHAR(2) NOT NULL,
    "iso3" CHAR(3),
    "dialing_code" TEXT,
    "currency_code" TEXT,
    "name_az" TEXT NOT NULL,
    "name_ru" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "countries_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "countries_iso2_key" ON "countries"("iso2");

CREATE TABLE "cities" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "code" TEXT NOT NULL,
    "country_iso2" CHAR(2) NOT NULL,
    "region" TEXT,
    "is_capital" BOOLEAN NOT NULL DEFAULT false,
    "name_az" TEXT NOT NULL,
    "name_ru" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "cities_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "cities_country_iso2_fkey" FOREIGN KEY ("country_iso2") REFERENCES "countries"("iso2") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "cities_code_key" ON "cities"("code");

CREATE TABLE "tax_rates" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "code" TEXT NOT NULL,
    "kind" "TaxRateKind" NOT NULL,
    "region" TEXT NOT NULL DEFAULT 'AZ',
    "percent" DECIMAL(7,4) NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "name_az" TEXT NOT NULL,
    "name_ru" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "tax_rates_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "tax_rates_code_key" ON "tax_rates"("code");
