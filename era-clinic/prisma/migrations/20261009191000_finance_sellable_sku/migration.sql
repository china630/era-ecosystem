-- Sellable Finance SKU on clinic procedure and diagnostic service cards.

ALTER TABLE "ProcedureType" ADD COLUMN "finance_sku" TEXT;
ALTER TABLE "DiagnosticService" ADD COLUMN "finance_sku" TEXT;
