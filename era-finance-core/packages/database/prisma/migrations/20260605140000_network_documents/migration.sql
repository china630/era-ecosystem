-- CreateEnum
CREATE TYPE "NetworkDocumentStatus" AS ENUM ('PENDING_REVIEW', 'ACCEPTED', 'REJECTED', 'POSTED', 'SUPERSEDED');

-- CreateTable
CREATE TABLE "network_documents" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "correlation_id" UUID NOT NULL,
    "issuer_organization_id" UUID NOT NULL,
    "recipient_organization_id" UUID NOT NULL,
    "source_invoice_id" UUID NOT NULL,
    "status" "NetworkDocumentStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "currency" TEXT NOT NULL DEFAULT 'AZN',
    "total_net" DECIMAL(19,4) NOT NULL,
    "vat_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "total_gross" DECIMAL(19,4) NOT NULL,
    "lines" JSONB NOT NULL DEFAULT '[]',
    "issuer_invoice_number" TEXT,
    "issuer_tax_id_blind_index" TEXT,
    "recipient_debit_role" TEXT,
    "recipient_claims_vat" BOOLEAN NOT NULL DEFAULT true,
    "recipient_transaction_id" UUID,
    "reject_reason" TEXT,
    "e_qaime_ref" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "network_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "network_documents_correlation_id_recipient_organization_id_key" ON "network_documents"("correlation_id", "recipient_organization_id");

-- CreateIndex
CREATE INDEX "network_documents_recipient_organization_id_status_created_at_idx" ON "network_documents"("recipient_organization_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "network_documents_issuer_organization_id_created_at_idx" ON "network_documents"("issuer_organization_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "network_documents" ADD CONSTRAINT "network_documents_issuer_organization_id_fkey" FOREIGN KEY ("issuer_organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "network_documents" ADD CONSTRAINT "network_documents_recipient_organization_id_fkey" FOREIGN KEY ("recipient_organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "network_documents" ADD CONSTRAINT "network_documents_source_invoice_id_fkey" FOREIGN KEY ("source_invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
