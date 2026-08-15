-- H-BL-48: Counterparty payment terms for AR due dates
ALTER TABLE "counterparties" ADD COLUMN IF NOT EXISTS "payment_terms_days" INTEGER;
