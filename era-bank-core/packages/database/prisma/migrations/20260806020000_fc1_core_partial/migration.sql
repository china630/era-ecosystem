-- FC-1 product depth: holds metadata, account limits, branch limits, package tariffs

ALTER TABLE "account_holds" ADD COLUMN "reference" TEXT;
ALTER TABLE "account_holds" ADD COLUMN "authority_code" TEXT;

ALTER TABLE "accounts" ADD COLUMN "daily_debit_limit_minor" BIGINT NOT NULL DEFAULT 0;

CREATE TABLE "branch_limits" (
    "id" TEXT NOT NULL,
    "bank_org_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "limit_code" TEXT NOT NULL,
    "amount_minor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'AZN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branch_limits_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "branch_limits_bank_org_id_branch_id_limit_code_key"
  ON "branch_limits"("bank_org_id", "branch_id", "limit_code");

CREATE INDEX "branch_limits_bank_org_id_branch_id_idx"
  ON "branch_limits"("bank_org_id", "branch_id");

CREATE TABLE "relationship_package_tariffs" (
    "id" TEXT NOT NULL,
    "bank_org_id" TEXT NOT NULL,
    "package_id" TEXT NOT NULL,
    "tariff_code" TEXT NOT NULL,
    "waiver_type" TEXT NOT NULL,
    "waiver_value" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "relationship_package_tariffs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "relationship_package_tariffs_package_id_tariff_code_key"
  ON "relationship_package_tariffs"("package_id", "tariff_code");

CREATE INDEX "relationship_package_tariffs_bank_org_id_package_id_idx"
  ON "relationship_package_tariffs"("bank_org_id", "package_id");

ALTER TABLE "relationship_package_tariffs"
  ADD CONSTRAINT "relationship_package_tariffs_package_id_fkey"
  FOREIGN KEY ("package_id") REFERENCES "relationship_packages"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
