-- Finance construction commercial spine (F1 amendments/SOV, F2 PayApp, F3 tender lifecycle)

CREATE TYPE "ContractRole" AS ENUM ('PRIME', 'COMMITMENT');
CREATE TYPE "ContractAmendmentStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CANCELLED');
CREATE TYPE "PayApplicationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'POSTED', 'CANCELLED');

ALTER TYPE "ProcurementProtocolStatus" ADD VALUE IF NOT EXISTS 'OPEN';
ALTER TYPE "ProcurementProtocolStatus" ADD VALUE IF NOT EXISTS 'AWARDED';
ALTER TYPE "ProcurementProtocolStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "contract_role" "ContractRole" NOT NULL DEFAULT 'PRIME';

ALTER TABLE "contract_lines" ADD COLUMN IF NOT EXISTS "code" VARCHAR(64);
ALTER TABLE "contract_lines" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "contract_amendments" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "organization_id" UUID NOT NULL,
  "contract_id" UUID NOT NULL,
  "status" "ContractAmendmentStatus" NOT NULL DEFAULT 'DRAFT',
  "number" TEXT NOT NULL,
  "amount_limit_delta" DECIMAL(19,4),
  "date_to" DATE,
  "description" TEXT,
  "source_type" VARCHAR(64),
  "source_id" VARCHAR(128),
  "activated_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "contract_amendments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "contract_amendments_org_number_key" ON "contract_amendments"("organization_id", "number");
CREATE UNIQUE INDEX IF NOT EXISTS "contract_amendments_source_unique" ON "contract_amendments"("organization_id", "source_type", "source_id") WHERE "source_type" IS NOT NULL AND "source_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "contract_amendments_contract_idx" ON "contract_amendments"("contract_id");
CREATE INDEX IF NOT EXISTS "contract_amendments_org_status_idx" ON "contract_amendments"("organization_id", "status");
ALTER TABLE "contract_amendments" ADD CONSTRAINT "contract_amendments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract_amendments" ADD CONSTRAINT "contract_amendments_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "pay_applications" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "organization_id" UUID NOT NULL,
  "contract_id" UUID NOT NULL,
  "number" TEXT NOT NULL,
  "period_from" DATE,
  "period_to" DATE,
  "retention_pct" DECIMAL(8,4) NOT NULL DEFAULT 0,
  "status" "PayApplicationStatus" NOT NULL DEFAULT 'DRAFT',
  "amount_gross" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "amount_retention" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "amount_net" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "print_snapshot_json" JSONB,
  "posted_journal_id" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "pay_applications_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "pay_applications_org_number_key" ON "pay_applications"("organization_id", "number");
CREATE INDEX IF NOT EXISTS "pay_applications_contract_idx" ON "pay_applications"("contract_id");
CREATE INDEX IF NOT EXISTS "pay_applications_org_status_idx" ON "pay_applications"("organization_id", "status");
ALTER TABLE "pay_applications" ADD CONSTRAINT "pay_applications_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pay_applications" ADD CONSTRAINT "pay_applications_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "pay_application_lines" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "pay_application_id" UUID NOT NULL,
  "contract_line_id" UUID,
  "description" TEXT,
  "quantity" DECIMAL(19,4),
  "amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "source_act_id" VARCHAR(128),
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "pay_application_lines_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "pay_application_lines_payapp_idx" ON "pay_application_lines"("pay_application_id");
ALTER TABLE "pay_application_lines" ADD CONSTRAINT "pay_application_lines_pay_application_id_fkey" FOREIGN KEY ("pay_application_id") REFERENCES "pay_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pay_application_lines" ADD CONSTRAINT "pay_application_lines_contract_line_id_fkey" FOREIGN KEY ("contract_line_id") REFERENCES "contract_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;
