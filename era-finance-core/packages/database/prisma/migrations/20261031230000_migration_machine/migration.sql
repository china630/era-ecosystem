-- Migration machine: cutover flags, draft batches, warehouse code, product category

ALTER TABLE "organizations"
  ADD COLUMN IF NOT EXISTS "migration_cutover_date" DATE,
  ADD COLUMN IF NOT EXISTS "migration_assembled_at" TIMESTAMPTZ(6);

ALTER TABLE "warehouses"
  ADD COLUMN IF NOT EXISTS "code" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "warehouses_org_code_uidx"
  ON "warehouses"("organization_id", "code")
  WHERE "code" IS NOT NULL AND "deleted_at" IS NULL;

ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "category" TEXT;

DO $$ BEGIN
  CREATE TYPE "MigrationDraftKind" AS ENUM (
    'STOCK',
    'OPEN_ITEMS',
    'ADVANCES',
    'CASH_BANK',
    'HR_BALANCES',
    'PAYROLL_LIABILITIES',
    'FIXED_ASSETS',
    'CAPITAL',
    'VAT_REGISTER'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "MigrationDraftStatus" AS ENUM ('DRAFT', 'CONSUMED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "migration_draft_batches" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "organization_id" UUID NOT NULL,
  "kind" "MigrationDraftKind" NOT NULL,
  "status" "MigrationDraftStatus" NOT NULL DEFAULT 'DRAFT',
  "uploaded_by_user_id" UUID,
  "file_name" TEXT,
  "created_count" INTEGER NOT NULL DEFAULT 0,
  "error_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "consumed_at" TIMESTAMPTZ(6),
  CONSTRAINT "migration_draft_batches_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "migration_draft_batches_org_kind_draft_uidx"
  ON "migration_draft_batches"("organization_id", "kind")
  WHERE "status" = 'DRAFT';

CREATE INDEX IF NOT EXISTS "migration_draft_batches_org_idx"
  ON "migration_draft_batches"("organization_id");

CREATE TABLE IF NOT EXISTS "migration_draft_lines" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "organization_id" UUID NOT NULL,
  "batch_id" UUID NOT NULL,
  "row_number" INTEGER NOT NULL,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "resolved" JSONB NOT NULL DEFAULT '{}',
  "error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "migration_draft_lines_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "migration_draft_lines_batch_idx"
  ON "migration_draft_lines"("batch_id");

CREATE INDEX IF NOT EXISTS "migration_draft_lines_org_idx"
  ON "migration_draft_lines"("organization_id");

CREATE TABLE IF NOT EXISTS "migration_upload_logs" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "organization_id" UUID NOT NULL,
  "kind" TEXT NOT NULL,
  "file_name" TEXT,
  "created_count" INTEGER NOT NULL DEFAULT 0,
  "error_count" INTEGER NOT NULL DEFAULT 0,
  "uploaded_by_user_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "migration_upload_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "migration_upload_logs_org_idx"
  ON "migration_upload_logs"("organization_id", "created_at" DESC);

ALTER TABLE "migration_draft_batches"
  DROP CONSTRAINT IF EXISTS "migration_draft_batches_organization_id_fkey",
  ADD CONSTRAINT "migration_draft_batches_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "migration_draft_lines"
  DROP CONSTRAINT IF EXISTS "migration_draft_lines_batch_id_fkey",
  ADD CONSTRAINT "migration_draft_lines_batch_id_fkey"
    FOREIGN KEY ("batch_id") REFERENCES "migration_draft_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "migration_draft_lines"
  DROP CONSTRAINT IF EXISTS "migration_draft_lines_organization_id_fkey",
  ADD CONSTRAINT "migration_draft_lines_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "migration_upload_logs"
  DROP CONSTRAINT IF EXISTS "migration_upload_logs_organization_id_fkey",
  ADD CONSTRAINT "migration_upload_logs_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
