-- Wave 5 NW-2: invoice center integrateToAccounting flag
ALTER TABLE "FiscalDocument" ADD COLUMN "integrateToAccounting" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "FiscalDocument_integrateToAccounting_idx" ON "FiscalDocument"("integrateToAccounting");
