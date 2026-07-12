-- Wave 4 Block E: ƏDV deposit ledger tracking

DO $wave4_vat_deposit_kind$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'VatDepositLedgerKind') THEN
    CREATE TYPE "VatDepositLedgerKind" AS ENUM (
      'INCOMING_ROUTE',
      'REMITTANCE',
      'ADJUSTMENT'
    );
  END IF;
END
$wave4_vat_deposit_kind$;

CREATE TABLE IF NOT EXISTS "vat_deposit_ledger_entries" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "kind" "VatDepositLedgerKind" NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "transaction_id" UUID,
    "bank_statement_line_id" UUID,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vat_deposit_ledger_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "vat_deposit_ledger_entries_organization_id_created_at_idx"
  ON "vat_deposit_ledger_entries"("organization_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "vat_deposit_ledger_entries_organization_id_kind_created_at_idx"
  ON "vat_deposit_ledger_entries"("organization_id", "kind", "created_at" DESC);

DO $wave4_vat_deposit_org_fk$
BEGIN
  ALTER TABLE "vat_deposit_ledger_entries"
    ADD CONSTRAINT "vat_deposit_ledger_entries_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$wave4_vat_deposit_org_fk$;

DO $wave4_vat_deposit_tx_fk$
BEGIN
  ALTER TABLE "vat_deposit_ledger_entries"
    ADD CONSTRAINT "vat_deposit_ledger_entries_transaction_id_fkey"
    FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$wave4_vat_deposit_tx_fk$;

DO $wave4_vat_deposit_bsl_fk$
BEGIN
  ALTER TABLE "vat_deposit_ledger_entries"
    ADD CONSTRAINT "vat_deposit_ledger_entries_bank_statement_line_id_fkey"
    FOREIGN KEY ("bank_statement_line_id") REFERENCES "bank_statement_lines"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$wave4_vat_deposit_bsl_fk$;
