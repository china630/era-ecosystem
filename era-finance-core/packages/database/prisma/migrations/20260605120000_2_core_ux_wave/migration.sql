-- FEAT-FC-UX-006 prepaid description; FEAT-FC-UX-007 counterparty director/phones/FIN
ALTER TABLE "prepaid_expenses" ADD COLUMN IF NOT EXISTS "description" TEXT;

ALTER TABLE "counterparties" ADD COLUMN IF NOT EXISTS "director_name_cipher" TEXT;
ALTER TABLE "counterparties" ADD COLUMN IF NOT EXISTS "phones_json" JSONB DEFAULT '[]';
ALTER TABLE "counterparties" ADD COLUMN IF NOT EXISTS "fin_code_cipher" TEXT;
ALTER TABLE "counterparties" ADD COLUMN IF NOT EXISTS "fin_code_blind_index" TEXT;
