-- Fiscal year close per AccountingBook; account codes unique per book
-- (same LedgerType across EXTRA MANAGEMENT books must not collide).

-- ── Account uniqueness: (org, book, code) ──────────────────────────────────
UPDATE "accounts" a
SET "accounting_book_id" = b."id"
FROM "accounting_books" b
WHERE a."accounting_book_id" IS NULL
  AND b."organization_id" = a."organization_id"
  AND b."code" = a."ledger_type"::text;

UPDATE "accounts" a
SET "accounting_book_id" = b."id"
FROM "accounting_books" b
WHERE a."accounting_book_id" IS NULL
  AND a."ledger_type" = 'MANAGEMENT'
  AND b."organization_id" = a."organization_id"
  AND b."gaap_kind" = 'MANAGEMENT'
  AND b."status" = 'ACTIVE';

-- Orphan MANAGEMENT rows without a peer book: attach to a synthetic EXTRA book.
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
SELECT DISTINCT
    a."organization_id",
    'MGMT_ORPHAN',
    'İdarəetmə (miqrasiya)',
    'Управленческая (миграция)',
    'Management (migration)',
    'MANAGEMENT'::"AccountingBookGaapKind",
    false,
    false,
    'ACTIVE'::"AccountingBookStatus",
    'EXTRA'::"AccountingBookBillingSlotKind",
    90,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "accounts" a
WHERE a."accounting_book_id" IS NULL
  AND a."ledger_type" = 'MANAGEMENT'::"LedgerType"
  AND NOT EXISTS (
    SELECT 1
    FROM "accounting_books" b
    WHERE b."organization_id" = a."organization_id"
      AND b."code" = 'MGMT_ORPHAN'
  );

UPDATE "accounts" a
SET "accounting_book_id" = b."id"
FROM "accounting_books" b
WHERE a."accounting_book_id" IS NULL
  AND a."ledger_type" = 'MANAGEMENT'
  AND b."organization_id" = a."organization_id"
  AND b."code" = 'MGMT_ORPHAN';

-- Fail loudly if anything remains unscoped (should not happen after NAS/IFRS backfill).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "accounts" WHERE "accounting_book_id" IS NULL LIMIT 1) THEN
    RAISE EXCEPTION 'accounts.accounting_book_id still NULL after multi-book backfill';
  END IF;
END $$;

ALTER TABLE "accounts" ALTER COLUMN "accounting_book_id" SET NOT NULL;

DROP INDEX IF EXISTS "accounts_organization_id_code_ledger_type_key";

CREATE UNIQUE INDEX "accounts_organization_id_accounting_book_id_code_key"
  ON "accounts"("organization_id", "accounting_book_id", "code");

-- ── FiscalYearClose per book ───────────────────────────────────────────────
ALTER TABLE "fiscal_year_closes"
  ADD COLUMN IF NOT EXISTS "accounting_book_id" UUID;

UPDATE "fiscal_year_closes" fyc
SET "accounting_book_id" = b."id"
FROM "accounting_books" b
WHERE fyc."accounting_book_id" IS NULL
  AND b."organization_id" = fyc."organization_id"
  AND b."code" = 'NAS';

DELETE FROM "fiscal_year_closes" WHERE "accounting_book_id" IS NULL;

ALTER TABLE "fiscal_year_closes" ALTER COLUMN "accounting_book_id" SET NOT NULL;

ALTER TABLE "fiscal_year_closes"
  DROP CONSTRAINT IF EXISTS "fiscal_year_closes_organization_id_year_key";

CREATE UNIQUE INDEX "fiscal_year_closes_organization_id_accounting_book_id_year_key"
  ON "fiscal_year_closes"("organization_id", "accounting_book_id", "year");

CREATE INDEX "fiscal_year_closes_accounting_book_id_idx"
  ON "fiscal_year_closes"("accounting_book_id");

ALTER TABLE "fiscal_year_closes"
  DROP CONSTRAINT IF EXISTS "fiscal_year_closes_accounting_book_id_fkey";

ALTER TABLE "fiscal_year_closes"
  ADD CONSTRAINT "fiscal_year_closes_accounting_book_id_fkey"
  FOREIGN KEY ("accounting_book_id") REFERENCES "accounting_books"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
