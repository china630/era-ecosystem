CREATE TYPE "hotel_day_document_status" AS ENUM ('POSTING', 'POSTED', 'REJECTED');

CREATE TABLE "hotel_day_documents" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "business_date" VARCHAR(10) NOT NULL,
    "reference" VARCHAR(40) NOT NULL,
    "status" "hotel_day_document_status" NOT NULL,
    "error_message" TEXT,
    "payload_json" JSONB NOT NULL,
    "transaction_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hotel_day_documents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "hotel_day_documents_org_ref_uidx" ON "hotel_day_documents"("organization_id", "reference");
CREATE INDEX "hotel_day_documents_organization_id_status_idx" ON "hotel_day_documents"("organization_id", "status");

ALTER TABLE "hotel_day_documents" ADD CONSTRAINT "hotel_day_documents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
