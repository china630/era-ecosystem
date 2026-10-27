-- CP-ORG-PROFILE-01: organization branding profile + multi contacts/addresses
CREATE TYPE "OrgContactKind" AS ENUM ('PHONE', 'MOBILE', 'FAX', 'EMAIL', 'WEBSITE', 'WHATSAPP', 'TELEGRAM');
CREATE TYPE "OrgContactPurpose" AS ENUM ('GENERAL', 'LEGAL', 'BILLING', 'BOOKING', 'EMERGENCY', 'PRINT');
CREATE TYPE "OrgAddressKind" AS ENUM ('LEGAL', 'POSTAL', 'SITE', 'BRANCH');

CREATE TABLE "organization_profiles" (
  "organization_id" UUID NOT NULL,
  "trade_name" TEXT,
  "name_az" TEXT,
  "name_ru" TEXT,
  "name_en" TEXT,
  "director_name" TEXT,
  "director_title" TEXT,
  "logo_url" TEXT,
  "stamp_url" TEXT,
  "signature_director_url" TEXT,
  "bank_line" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "organization_profiles_pkey" PRIMARY KEY ("organization_id")
);

ALTER TABLE "organization_profiles"
  ADD CONSTRAINT "organization_profiles_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "organization_contact_channels" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "organization_id" UUID NOT NULL,
  "kind" "OrgContactKind" NOT NULL,
  "value" TEXT NOT NULL,
  "label" TEXT,
  "purpose" "OrgContactPurpose" NOT NULL DEFAULT 'GENERAL',
  "is_primary" BOOLEAN NOT NULL DEFAULT false,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "organization_contact_channels_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "organization_contact_channels_org_kind_idx"
  ON "organization_contact_channels"("organization_id", "kind");

CREATE UNIQUE INDEX "organization_contact_channels_primary_kind_uidx"
  ON "organization_contact_channels"("organization_id", "kind")
  WHERE "is_primary" = true;

ALTER TABLE "organization_contact_channels"
  ADD CONSTRAINT "organization_contact_channels_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organization_profiles"("organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "organization_addresses" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "organization_id" UUID NOT NULL,
  "kind" "OrgAddressKind" NOT NULL,
  "line1" TEXT NOT NULL,
  "line2" TEXT,
  "city" TEXT,
  "region" TEXT,
  "postal_code" TEXT,
  "country" TEXT DEFAULT 'AZ',
  "line_az" TEXT,
  "line_ru" TEXT,
  "line_en" TEXT,
  "is_primary" BOOLEAN NOT NULL DEFAULT false,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "organization_addresses_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "organization_addresses_org_kind_idx"
  ON "organization_addresses"("organization_id", "kind");

CREATE UNIQUE INDEX "organization_addresses_primary_kind_uidx"
  ON "organization_addresses"("organization_id", "kind")
  WHERE "is_primary" = true;

ALTER TABLE "organization_addresses"
  ADD CONSTRAINT "organization_addresses_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organization_profiles"("organization_id") ON DELETE CASCADE ON UPDATE CASCADE;
