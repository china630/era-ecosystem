-- CreateEnum
CREATE TYPE "InstitutionType" AS ENUM ('BANK', 'BOKT', 'LEASING_COMPANY', 'CREDIT_UNION');

-- CreateTable
CREATE TABLE "bank_institution_configs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "bank_org_id" TEXT NOT NULL,
    "institution_type" "InstitutionType" NOT NULL DEFAULT 'BANK',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_institution_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bank_institution_configs_bank_org_id_key" ON "bank_institution_configs"("bank_org_id");

-- CreateIndex
CREATE INDEX "bank_institution_configs_organization_id_idx" ON "bank_institution_configs"("organization_id");

-- Seed default BANK for orgs already present (branches + GL fallback).
INSERT INTO "bank_institution_configs" ("id", "organization_id", "bank_org_id", "institution_type", "created_at", "updated_at")
SELECT
    'inst' || substr(md5(s.bank_org_id || ':' || s.organization_id), 1, 21),
    s.organization_id,
    s.bank_org_id,
    'BANK'::"InstitutionType",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM (
    SELECT DISTINCT organization_id, bank_org_id FROM branches
    UNION
    SELECT DISTINCT organization_id, bank_org_id FROM gl_accounts
) AS s
WHERE NOT EXISTS (
    SELECT 1 FROM "bank_institution_configs" c WHERE c.bank_org_id = s.bank_org_id
);