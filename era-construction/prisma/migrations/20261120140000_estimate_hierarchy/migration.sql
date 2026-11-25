-- Five-level estimate pack + project dual mode (ADR construction-estimate-hierarchy)

ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "estimate_mode" TEXT NOT NULL DEFAULT 'FLAT_BOQ';
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "finance_contract_id" TEXT;

ALTER TABLE "BoqLine" ADD COLUMN IF NOT EXISTS "estimate_line_id" TEXT;

CREATE TABLE IF NOT EXISTS "EstimatePackage" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "finance_contract_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EstimatePackage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EstimatePackage_project_id_version_key" ON "EstimatePackage"("project_id", "version");
CREATE INDEX IF NOT EXISTS "EstimatePackage_organization_id_idx" ON "EstimatePackage"("organization_id");
CREATE INDEX IF NOT EXISTS "EstimatePackage_project_id_status_idx" ON "EstimatePackage"("project_id", "status");

CREATE TABLE IF NOT EXISTS "EstimateDocument" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "package_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "cipher" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "parent_document_id" TEXT,
    "chapter_no" INTEGER,
    "amount_net" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EstimateDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EstimateDocument_package_id_cipher_key" ON "EstimateDocument"("package_id", "cipher");
CREATE INDEX IF NOT EXISTS "EstimateDocument_organization_id_idx" ON "EstimateDocument"("organization_id");
CREATE INDEX IF NOT EXISTS "EstimateDocument_package_id_kind_idx" ON "EstimateDocument"("package_id", "kind");

CREATE TABLE IF NOT EXISTS "EstimateLine" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "item_code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'ед.',
    "qty" DECIMAL(14,3) NOT NULL,
    "unit_rate" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "amount_net" DECIMAL(14,2) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "boq_line_id" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EstimateLine_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "EstimateLine_document_id_sort_order_idx" ON "EstimateLine"("document_id", "sort_order");
CREATE INDEX IF NOT EXISTS "EstimateLine_organization_id_idx" ON "EstimateLine"("organization_id");
CREATE INDEX IF NOT EXISTS "EstimateLine_item_code_idx" ON "EstimateLine"("item_code");

DO $$ BEGIN
  ALTER TABLE "EstimatePackage" ADD CONSTRAINT "EstimatePackage_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "EstimateDocument" ADD CONSTRAINT "EstimateDocument_package_id_fkey"
    FOREIGN KEY ("package_id") REFERENCES "EstimatePackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "EstimateDocument" ADD CONSTRAINT "EstimateDocument_parent_document_id_fkey"
    FOREIGN KEY ("parent_document_id") REFERENCES "EstimateDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "EstimateLine" ADD CONSTRAINT "EstimateLine_document_id_fkey"
    FOREIGN KEY ("document_id") REFERENCES "EstimateDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
