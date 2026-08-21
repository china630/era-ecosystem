-- Agency portal identity (B2B extranet) — ADR hotel-agency-portal
CREATE TABLE IF NOT EXISTS "agency_portal_accounts" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "email" TEXT NOT NULL,
  "password_hash" TEXT NOT NULL,
  "full_name" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "agency_portal_accounts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "agency_portal_accounts_email_key" ON "agency_portal_accounts"("email");

CREATE TABLE IF NOT EXISTS "agency_property_grants" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "account_id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "agency_voen" VARCHAR(10) NOT NULL,
  "local_agency_id" TEXT NOT NULL,
  "local_agency_code" TEXT,
  "revoked_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "agency_property_grants_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "agency_property_grants_account_id_organization_id_local_agency_id_key"
  ON "agency_property_grants"("account_id", "organization_id", "local_agency_id");
CREATE INDEX IF NOT EXISTS "agency_property_grants_organization_id_idx" ON "agency_property_grants"("organization_id");
CREATE INDEX IF NOT EXISTS "agency_property_grants_agency_voen_idx" ON "agency_property_grants"("agency_voen");
DO $$ BEGIN
  ALTER TABLE "agency_property_grants"
    ADD CONSTRAINT "agency_property_grants_account_id_fkey"
    FOREIGN KEY ("account_id") REFERENCES "agency_portal_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "agency_property_grants"
    ADD CONSTRAINT "agency_property_grants_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
