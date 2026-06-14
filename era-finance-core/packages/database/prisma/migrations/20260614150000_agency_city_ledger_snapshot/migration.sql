-- Agency city-ledger snapshots from hotel SATELLITE_HOTEL_CITY_LEDGER_SNAPSHOT events.

CREATE TABLE IF NOT EXISTS "agency_city_ledger_snapshots" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "hotel_agency_id" TEXT NOT NULL,
    "agency_code" TEXT NOT NULL,
    "as_of_date" TEXT NOT NULL,
    "balance" DECIMAL(18,2) NOT NULL,
    "period_charges" DECIMAL(18,2) NOT NULL,
    "period_payments" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'AZN',
    "correlation_id" TEXT NOT NULL,
    "counterparty_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agency_city_ledger_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "agency_cl_snapshots_org_agency_date_idx"
    ON "agency_city_ledger_snapshots"("organization_id", "hotel_agency_id", "as_of_date");

CREATE INDEX IF NOT EXISTS "agency_cl_snapshots_org_cp_idx"
    ON "agency_city_ledger_snapshots"("organization_id", "counterparty_id");

ALTER TABLE "agency_city_ledger_snapshots"
    ADD CONSTRAINT "agency_city_ledger_snapshots_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "agency_city_ledger_snapshots"
    ADD CONSTRAINT "agency_city_ledger_snapshots_counterparty_id_fkey"
    FOREIGN KEY ("counterparty_id") REFERENCES "counterparties"("id") ON DELETE SET NULL ON UPDATE CASCADE;
