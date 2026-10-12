CREATE TABLE "counterparty_card_requests" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "tax_id_blind_index" TEXT NOT NULL,
    "tax_id_cipher" TEXT NOT NULL,
    "name_cipher" TEXT NOT NULL,
    "party_kind" TEXT NOT NULL,
    "legal_form" "CounterpartyLegalForm" NOT NULL DEFAULT 'LLC',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "source" TEXT NOT NULL DEFAULT 'HOTEL',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "counterparty_card_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "counterparty_card_requests_organization_id_tax_id_blind_index_key"
    ON "counterparty_card_requests"("organization_id", "tax_id_blind_index");

CREATE INDEX "counterparty_card_requests_organization_id_status_idx"
    ON "counterparty_card_requests"("organization_id", "status");

ALTER TABLE "counterparty_card_requests"
    ADD CONSTRAINT "counterparty_card_requests_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
