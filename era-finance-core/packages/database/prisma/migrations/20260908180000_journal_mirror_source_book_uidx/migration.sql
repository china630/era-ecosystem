-- Multi-target mirror: uniqueness by target accounting book, not ledgerType
-- (TAX/MANAGEMENT/CUSTOM share LedgerType.MANAGEMENT).
DROP INDEX IF EXISTS "journal_entries_source_ledger_uidx";

CREATE UNIQUE INDEX "journal_entries_source_book_uidx"
  ON "journal_entries" ("source_journal_entry_id", "accounting_book_id")
  WHERE "source_journal_entry_id" IS NOT NULL AND "accounting_book_id" IS NOT NULL;
