CREATE TABLE "satellite_events_processed" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "correlation_id" VARCHAR(128) NOT NULL,
    "event_type" VARCHAR(64) NOT NULL,
    "result_json" JSONB,
    "transaction_id" UUID,
    "invoice_id" UUID,
    "processed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "satellite_events_processed_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "satellite_events_org_corr_uidx" ON "satellite_events_processed"("organization_id", "correlation_id");
CREATE INDEX "satellite_events_processed_organization_id_event_type_processed_at_idx" ON "satellite_events_processed"("organization_id", "event_type", "processed_at");

ALTER TABLE "satellite_events_processed" ADD CONSTRAINT "satellite_events_processed_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
