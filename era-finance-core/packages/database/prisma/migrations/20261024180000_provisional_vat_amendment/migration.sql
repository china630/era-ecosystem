-- Provisional input VAT and a filed-period amendment draft. No cash refund.

CREATE TYPE "ProvisionalVatStatus" AS ENUM ('WAITING_DOCUMENT', 'CREDITED');
CREATE TYPE "TaxAmendmentDraftStatus" AS ENUM ('DRAFT', 'SENT');

ALTER TABLE "tax_declaration_exports"
  ADD COLUMN "amount_azn" DECIMAL(19, 4),
  ADD COLUMN "previous_amount_azn" DECIMAL(19, 4);

CREATE TABLE "provisional_vat_claims" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "organization_id" UUID NOT NULL,
  "purchase_transaction_id" UUID NOT NULL,
  "status" "ProvisionalVatStatus" NOT NULL DEFAULT 'WAITING_DOCUMENT',
  "vat_amount" DECIMAL(19, 4) NOT NULL,
  "adjustment_transaction_id" UUID,
  "document_ref" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "provisional_vat_claims_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "provisional_vat_claims_purchase_transaction_id_key"
  ON "provisional_vat_claims"("purchase_transaction_id");
CREATE UNIQUE INDEX "provisional_vat_claims_adjustment_transaction_id_key"
  ON "provisional_vat_claims"("adjustment_transaction_id");
CREATE INDEX "provisional_vat_claims_organization_id_status_idx"
  ON "provisional_vat_claims"("organization_id", "status");

ALTER TABLE "provisional_vat_claims"
  ADD CONSTRAINT "provisional_vat_claims_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "provisional_vat_claims"
  ADD CONSTRAINT "provisional_vat_claims_purchase_transaction_id_fkey"
  FOREIGN KEY ("purchase_transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "provisional_vat_claims"
  ADD CONSTRAINT "provisional_vat_claims_adjustment_transaction_id_fkey"
  FOREIGN KEY ("adjustment_transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "tax_amendment_drafts" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "organization_id" UUID NOT NULL,
  "tax_type" "TaxDeclarationType" NOT NULL,
  "period" TEXT NOT NULL,
  "source_export_id" UUID,
  "previous_amount" DECIMAL(19, 4) NOT NULL,
  "revised_amount" DECIMAL(19, 4) NOT NULL,
  "delta_amount" DECIMAL(19, 4) NOT NULL,
  "status" "TaxAmendmentDraftStatus" NOT NULL DEFAULT 'DRAFT',
  "sent_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tax_amendment_drafts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tax_amendment_drafts_organization_id_tax_type_period_key"
  ON "tax_amendment_drafts"("organization_id", "tax_type", "period");
CREATE INDEX "tax_amendment_drafts_organization_id_status_idx"
  ON "tax_amendment_drafts"("organization_id", "status");

ALTER TABLE "tax_amendment_drafts"
  ADD CONSTRAINT "tax_amendment_drafts_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
