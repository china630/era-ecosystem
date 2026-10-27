-- Finance → Hotel city-ledger payment-applied durable outbox
CREATE TYPE "HotelPaymentCallbackStatus" AS ENUM ('PENDING', 'DONE', 'DEAD');

CREATE TABLE "hotel_payment_callback_outbox" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "folio_id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "payment_id" TEXT NOT NULL,
    "amount_azn" DECIMAL(19,4) NOT NULL,
    "fully_paid" BOOLEAN NOT NULL,
    "status" "HotelPaymentCallbackStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hotel_payment_callback_outbox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "hotel_pay_cb_org_folio_payment_uidx" ON "hotel_payment_callback_outbox"("organization_id", "folio_id", "payment_id");
CREATE INDEX "hotel_pay_cb_status_next_idx" ON "hotel_payment_callback_outbox"("status", "next_attempt_at");
CREATE INDEX "hotel_pay_cb_org_invoice_idx" ON "hotel_payment_callback_outbox"("organization_id", "invoice_id");

ALTER TABLE "hotel_payment_callback_outbox" ADD CONSTRAINT "hotel_payment_callback_outbox_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
