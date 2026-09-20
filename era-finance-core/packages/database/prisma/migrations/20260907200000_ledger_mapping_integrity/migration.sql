-- P0 IFRS Integrity: LedgerMappingSet/Line + Transaction mirror fields + JournalEntry provenance

CREATE TYPE "LedgerMappingSetStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "TransactionMirrorStatus" AS ENUM ('NONE', 'POSTED', 'FAILED');

CREATE TABLE "ledger_mapping_sets" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "code" TEXT NOT NULL DEFAULT 'NAS_TO_IFRS',
    "version" INTEGER NOT NULL,
    "status" "LedgerMappingSetStatus" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMPTZ(6),
    "published_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ledger_mapping_sets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ledger_mapping_lines" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "mapping_set_id" UUID NOT NULL,
    "source_account_id" UUID NOT NULL,
    "target_account_id" UUID NOT NULL,
    "ratio" DECIMAL(19,8) NOT NULL DEFAULT 1,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ledger_mapping_lines_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ledger_mapping_sets_organization_id_code_version_key" ON "ledger_mapping_sets"("organization_id", "code", "version");
CREATE INDEX "ledger_mapping_sets_organization_id_code_status_idx" ON "ledger_mapping_sets"("organization_id", "code", "status");
CREATE UNIQUE INDEX "ledger_mapping_sets_one_published" ON "ledger_mapping_sets"("organization_id", "code") WHERE "status" = 'PUBLISHED';

CREATE UNIQUE INDEX "ledger_mapping_lines_mapping_set_id_source_account_id_sort_order_key" ON "ledger_mapping_lines"("mapping_set_id", "source_account_id", "sort_order");
CREATE INDEX "ledger_mapping_lines_mapping_set_id_idx" ON "ledger_mapping_lines"("mapping_set_id");
CREATE INDEX "ledger_mapping_lines_source_account_id_idx" ON "ledger_mapping_lines"("source_account_id");
CREATE INDEX "ledger_mapping_lines_target_account_id_idx" ON "ledger_mapping_lines"("target_account_id");

ALTER TABLE "ledger_mapping_sets" ADD CONSTRAINT "ledger_mapping_sets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ledger_mapping_sets" ADD CONSTRAINT "ledger_mapping_sets_published_by_user_id_fkey" FOREIGN KEY ("published_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ledger_mapping_lines" ADD CONSTRAINT "ledger_mapping_lines_mapping_set_id_fkey" FOREIGN KEY ("mapping_set_id") REFERENCES "ledger_mapping_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ledger_mapping_lines" ADD CONSTRAINT "ledger_mapping_lines_source_account_id_fkey" FOREIGN KEY ("source_account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ledger_mapping_lines" ADD CONSTRAINT "ledger_mapping_lines_target_account_id_fkey" FOREIGN KEY ("target_account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "transactions" ADD COLUMN "mirror_status" "TransactionMirrorStatus" NOT NULL DEFAULT 'NONE';
ALTER TABLE "transactions" ADD COLUMN "mirror_mapping_set_id" UUID;
ALTER TABLE "transactions" ADD COLUMN "mirror_error_code" TEXT;
ALTER TABLE "transactions" ADD COLUMN "mirror_error_detail" JSONB;

CREATE INDEX "transactions_org_mirror_status_idx" ON "transactions"("organization_id", "mirror_status");
CREATE INDEX "transactions_mirror_mapping_set_id_idx" ON "transactions"("mirror_mapping_set_id");
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_mirror_mapping_set_id_fkey" FOREIGN KEY ("mirror_mapping_set_id") REFERENCES "ledger_mapping_sets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "journal_entries" ADD COLUMN "source_journal_entry_id" UUID;
ALTER TABLE "journal_entries" ADD COLUMN "mapping_line_id" UUID;
CREATE INDEX "journal_entries_source_journal_entry_id_idx" ON "journal_entries"("source_journal_entry_id");
CREATE INDEX "journal_entries_mapping_line_id_idx" ON "journal_entries"("mapping_line_id");
CREATE UNIQUE INDEX "journal_entries_source_ledger_uidx" ON "journal_entries"("source_journal_entry_id", "ledger_type") WHERE "source_journal_entry_id" IS NOT NULL;
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_source_journal_entry_id_fkey" FOREIGN KEY ("source_journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_mapping_line_id_fkey" FOREIGN KEY ("mapping_line_id") REFERENCES "ledger_mapping_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "transactions" t
SET "mirror_status" = 'POSTED'
WHERE EXISTS (
  SELECT 1 FROM "journal_entries" je
  WHERE je."transaction_id" = t."id"
    AND je."ledger_type" = 'IFRS'
);
