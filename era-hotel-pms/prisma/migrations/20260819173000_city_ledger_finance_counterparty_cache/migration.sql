-- Cache Finance counterparty id on Hotel PMS agency (for City Ledger transfer gate)
ALTER TABLE "Agency" ADD COLUMN IF NOT EXISTS "financeCounterpartyId" TEXT;

