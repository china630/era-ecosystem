-- P1-1 leasing MVP + P1-2 MFI group lending MVP

DO $$ BEGIN
  CREATE TYPE "LoanLiabilityType" AS ENUM ('INDIVIDUAL', 'JLG', 'SOLIDARITY');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "BorrowerGroupStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "GroupMemberRole" AS ENUM ('LEADER', 'MEMBER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "LeaseAssetStatus" AS ENUM ('AVAILABLE', 'LEASED', 'RETIRED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "LeaseContractStatus" AS ENUM ('DRAFT', 'ACTIVE', 'MATURED', 'CLOSED', 'DEFAULTED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "loan_contracts" ADD COLUMN IF NOT EXISTS "group_id" TEXT;
ALTER TABLE "loan_contracts" ADD COLUMN IF NOT EXISTS "liability_type" "LoanLiabilityType";

CREATE INDEX IF NOT EXISTS "loan_contracts_bank_org_id_group_id_idx" ON "loan_contracts"("bank_org_id", "group_id");

CREATE TABLE IF NOT EXISTS "lease_assets" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "bank_org_id" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "serial_ref" TEXT,
  "catalog_value_minor" BIGINT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'AZN',
  "status" "LeaseAssetStatus" NOT NULL DEFAULT 'AVAILABLE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "lease_assets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "lease_assets_bank_org_id_status_idx" ON "lease_assets"("bank_org_id", "status");
CREATE INDEX IF NOT EXISTS "lease_assets_organization_id_idx" ON "lease_assets"("organization_id");

CREATE TABLE IF NOT EXISTS "lease_contracts" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "bank_org_id" TEXT NOT NULL,
  "customer_id" TEXT NOT NULL,
  "asset_id" TEXT NOT NULL,
  "loan_contract_id" TEXT,
  "advance_pct" DECIMAL(5,2) NOT NULL,
  "residual_value_minor" BIGINT NOT NULL,
  "term_months" INTEGER NOT NULL,
  "rate_annual" DECIMAL(9,6) NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'AZN',
  "status" "LeaseContractStatus" NOT NULL DEFAULT 'DRAFT',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "lease_contracts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "lease_contracts_loan_contract_id_key" ON "lease_contracts"("loan_contract_id");
CREATE INDEX IF NOT EXISTS "lease_contracts_bank_org_id_customer_id_idx" ON "lease_contracts"("bank_org_id", "customer_id");
CREATE INDEX IF NOT EXISTS "lease_contracts_bank_org_id_status_idx" ON "lease_contracts"("bank_org_id", "status");
CREATE INDEX IF NOT EXISTS "lease_contracts_organization_id_idx" ON "lease_contracts"("organization_id");

DO $$ BEGIN
  ALTER TABLE "lease_contracts" ADD CONSTRAINT "lease_contracts_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "lease_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "lease_contracts" ADD CONSTRAINT "lease_contracts_loan_contract_id_fkey" FOREIGN KEY ("loan_contract_id") REFERENCES "loan_contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "borrower_groups" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "bank_org_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "liability_type" "LoanLiabilityType" NOT NULL DEFAULT 'JLG',
  "status" "BorrowerGroupStatus" NOT NULL DEFAULT 'DRAFT',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "borrower_groups_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "borrower_groups_bank_org_id_status_idx" ON "borrower_groups"("bank_org_id", "status");
CREATE INDEX IF NOT EXISTS "borrower_groups_organization_id_idx" ON "borrower_groups"("organization_id");

CREATE TABLE IF NOT EXISTS "group_memberships" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "bank_org_id" TEXT NOT NULL,
  "group_id" TEXT NOT NULL,
  "customer_id" TEXT NOT NULL,
  "role" "GroupMemberRole" NOT NULL DEFAULT 'MEMBER',
  "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "group_memberships_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "group_memberships_group_id_customer_id_key" ON "group_memberships"("group_id", "customer_id");
CREATE INDEX IF NOT EXISTS "group_memberships_bank_org_id_customer_id_idx" ON "group_memberships"("bank_org_id", "customer_id");
CREATE INDEX IF NOT EXISTS "group_memberships_organization_id_idx" ON "group_memberships"("organization_id");

DO $$ BEGIN
  ALTER TABLE "group_memberships" ADD CONSTRAINT "group_memberships_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "borrower_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "loan_contracts" ADD CONSTRAINT "loan_contracts_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "borrower_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;