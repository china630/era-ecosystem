-- Wave A: tenant-scoped accounting books with legacy NAS/IFRS aliases.

CREATE TYPE "AccountingBookStatus" AS ENUM ('ACTIVE', 'RETIRED');
CREATE TYPE "AccountingBookBillingSlotKind" AS ENUM ('INCLUDED', 'EXTRA');
CREATE TYPE "AccountingBookGaapKind" AS ENUM ('NAS', 'IFRS', 'TAX', 'MANAGEMENT', 'CUSTOM');

CREATE TABLE "accounting_books" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name_az" TEXT NOT NULL,
    "name_ru" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "gaap_kind" "AccountingBookGaapKind" NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_default_ops" BOOLEAN NOT NULL DEFAULT false,
    "status" "AccountingBookStatus" NOT NULL DEFAULT 'ACTIVE',
    "billing_slot_kind" "AccountingBookBillingSlotKind" NOT NULL DEFAULT 'EXTRA',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounting_books_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "accounting_books_organization_id_code_key"
    ON "accounting_books"("organization_id", "code");
CREATE INDEX "accounting_books_organization_id_status_idx"
    ON "accounting_books"("organization_id", "status");

ALTER TABLE "accounting_books"
    ADD CONSTRAINT "accounting_books_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "journal_entries" ADD COLUMN "accounting_book_id" UUID;
ALTER TABLE "accounts" ADD COLUMN "accounting_book_id" UUID;
ALTER TABLE "ledger_mapping_sets" ADD COLUMN "from_book_id" UUID;
ALTER TABLE "ledger_mapping_sets" ADD COLUMN "to_book_id" UUID;

CREATE INDEX "journal_entries_accounting_book_id_idx"
    ON "journal_entries"("accounting_book_id");
CREATE INDEX "accounts_accounting_book_id_idx"
    ON "accounts"("accounting_book_id");
CREATE INDEX "ledger_mapping_sets_from_book_id_idx"
    ON "ledger_mapping_sets"("from_book_id");
CREATE INDEX "ledger_mapping_sets_to_book_id_idx"
    ON "ledger_mapping_sets"("to_book_id");

ALTER TABLE "journal_entries"
    ADD CONSTRAINT "journal_entries_accounting_book_id_fkey"
    FOREIGN KEY ("accounting_book_id") REFERENCES "accounting_books"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "accounts"
    ADD CONSTRAINT "accounts_accounting_book_id_fkey"
    FOREIGN KEY ("accounting_book_id") REFERENCES "accounting_books"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ledger_mapping_sets"
    ADD CONSTRAINT "ledger_mapping_sets_from_book_id_fkey"
    FOREIGN KEY ("from_book_id") REFERENCES "accounting_books"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ledger_mapping_sets"
    ADD CONSTRAINT "ledger_mapping_sets_to_book_id_fkey"
    FOREIGN KEY ("to_book_id") REFERENCES "accounting_books"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Every organization receives its statutory NAS system book.
INSERT INTO "accounting_books" (
    "organization_id",
    "code",
    "name_az",
    "name_ru",
    "name_en",
    "gaap_kind",
    "is_system",
    "is_default_ops",
    "status",
    "billing_slot_kind",
    "sort_order",
    "created_at",
    "updated_at"
)
SELECT
    o."id",
    'NAS',
    'Milli Mühasibat Uçotu Standartları',
    'Национальные стандарты бухгалтерского учёта',
    'National Accounting Standards',
    'NAS',
    true,
    true,
    'ACTIVE',
    'INCLUDED',
    0,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "organizations" o
ON CONFLICT ("organization_id", "code") DO NOTHING;

-- Legacy IFRS data proves historical use. The system IFRS book consumes the
-- IFRS bundle slot, represented as EXTRA in Finance (pricing remains in CP).
INSERT INTO "accounting_books" (
    "organization_id",
    "code",
    "name_az",
    "name_ru",
    "name_en",
    "gaap_kind",
    "is_system",
    "is_default_ops",
    "status",
    "billing_slot_kind",
    "sort_order",
    "created_at",
    "updated_at"
)
SELECT
    o."id",
    'IFRS',
    'Beynəlxalq Maliyyə Hesabatı Standartları',
    'Международные стандарты финансовой отчётности',
    'International Financial Reporting Standards',
    'IFRS',
    true,
    false,
    'ACTIVE',
    'EXTRA',
    10,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "organizations" o
WHERE EXISTS (
    SELECT 1
    FROM "accounts" a
    WHERE a."organization_id" = o."id"
      AND a."ledger_type" = 'IFRS'
)
OR EXISTS (
    SELECT 1
    FROM "journal_entries" je
    WHERE je."organization_id" = o."id"
      AND je."ledger_type" = 'IFRS'
)
ON CONFLICT ("organization_id", "code") DO NOTHING;

UPDATE "journal_entries" je
SET "accounting_book_id" = b."id"
FROM "accounting_books" b
WHERE b."organization_id" = je."organization_id"
  AND b."code" = je."ledger_type"::text
  AND je."accounting_book_id" IS NULL;

UPDATE "accounts" a
SET "accounting_book_id" = b."id"
FROM "accounting_books" b
WHERE b."organization_id" = a."organization_id"
  AND b."code" = a."ledger_type"::text
  AND a."accounting_book_id" IS NULL;

UPDATE "ledger_mapping_sets" s
SET "from_book_id" = b."id"
FROM "accounting_books" b
WHERE s."code" = 'NAS_TO_IFRS'
  AND b."organization_id" = s."organization_id"
  AND b."code" = 'NAS'
  AND s."from_book_id" IS NULL;

UPDATE "ledger_mapping_sets" s
SET "to_book_id" = b."id"
FROM "accounting_books" b
WHERE s."code" = 'NAS_TO_IFRS'
  AND b."organization_id" = s."organization_id"
  AND b."code" = 'IFRS'
  AND s."to_book_id" IS NULL;
