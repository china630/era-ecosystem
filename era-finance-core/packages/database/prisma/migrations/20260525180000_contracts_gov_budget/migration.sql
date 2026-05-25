-- CreateEnum
CREATE TYPE "ContractType" AS ENUM ('SUPPLY', 'SERVICE', 'FRAMEWORK', 'LEASE', 'CONSTRUCTION', 'INTERCOMPANY', 'OTHER');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUSPENDED', 'CLOSED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "BudgetYearStatus" AS ENUM ('DRAFT', 'APPROVED', 'AMENDED');

-- CreateTable
CREATE TABLE "contracts" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "counterparty_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "type" "ContractType" NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL DEFAULT 'AZN',
    "amount_limit" DECIMAL(19,4),
    "date_from" DATE,
    "date_to" DATE,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_lines" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "contract_id" UUID NOT NULL,
    "description" TEXT,
    "quantity" DECIMAL(19,4),
    "unit_price" DECIMAL(19,4),
    "amount" DECIMAL(19,4),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_commitments" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "contract_id" UUID NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "reference_type" VARCHAR(64) NOT NULL,
    "reference_id" VARCHAR(128) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_commitments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_years" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "status" "BudgetYearStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "budget_years_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_lines" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "budget_year_id" UUID NOT NULL,
    "account_code" TEXT NOT NULL,
    "department_id" UUID,
    "limit_annual" DECIMAL(19,4) NOT NULL,
    "limit_monthly" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "budget_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_commitments" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "budget_line_id" UUID NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "reference_type" VARCHAR(64) NOT NULL,
    "reference_id" VARCHAR(128) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "budget_commitments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contracts_organization_id_status_idx" ON "contracts"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_organization_id_number_key" ON "contracts"("organization_id", "number");

-- CreateIndex
CREATE INDEX "contract_lines_contract_id_idx" ON "contract_lines"("contract_id");

-- CreateIndex
CREATE INDEX "contract_commitments_contract_id_idx" ON "contract_commitments"("contract_id");

-- CreateIndex
CREATE INDEX "contract_commitments_reference_type_reference_id_idx" ON "contract_commitments"("reference_type", "reference_id");

-- CreateIndex
CREATE INDEX "budget_years_organization_id_year_idx" ON "budget_years"("organization_id", "year");

-- CreateIndex
CREATE UNIQUE INDEX "budget_years_organization_id_year_version_key" ON "budget_years"("organization_id", "year", "version");

-- CreateIndex
CREATE INDEX "budget_lines_budget_year_id_idx" ON "budget_lines"("budget_year_id");

-- CreateIndex
CREATE INDEX "budget_lines_budget_year_id_account_code_idx" ON "budget_lines"("budget_year_id", "account_code");

-- CreateIndex
CREATE INDEX "budget_commitments_budget_line_id_idx" ON "budget_commitments"("budget_line_id");

-- CreateIndex
CREATE INDEX "budget_commitments_reference_type_reference_id_idx" ON "budget_commitments"("reference_type", "reference_id");

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_counterparty_id_fkey" FOREIGN KEY ("counterparty_id") REFERENCES "counterparties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_currency_fkey" FOREIGN KEY ("currency") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_lines" ADD CONSTRAINT "contract_lines_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_commitments" ADD CONSTRAINT "contract_commitments_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_years" ADD CONSTRAINT "budget_years_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_lines" ADD CONSTRAINT "budget_lines_budget_year_id_fkey" FOREIGN KEY ("budget_year_id") REFERENCES "budget_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_lines" ADD CONSTRAINT "budget_lines_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_commitments" ADD CONSTRAINT "budget_commitments_budget_line_id_fkey" FOREIGN KEY ("budget_line_id") REFERENCES "budget_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;
