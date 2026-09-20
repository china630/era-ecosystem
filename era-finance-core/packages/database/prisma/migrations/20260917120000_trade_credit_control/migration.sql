-- Trade credit control Phase 0: facility, pickup grants, buyer meter snapshots.

CREATE TYPE "TradeCreditFacilityStatus" AS ENUM ('ACTIVE', 'DISABLED');
CREATE TYPE "TradeCreditGrantStatus" AS ENUM ('ISSUED', 'CONSUMED', 'EXPIRED', 'VOID');

CREATE TABLE IF NOT EXISTS "trade_credit_facilities" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "counterparty_id" UUID NOT NULL,
    "credit_limit" DECIMAL(19,4) NOT NULL,
    "stop_list" BOOLEAN NOT NULL DEFAULT false,
    "status" "TradeCreditFacilityStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trade_credit_facilities_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "trade_credit_facilities_organization_id_counterparty_id_key"
    ON "trade_credit_facilities"("organization_id", "counterparty_id");

CREATE INDEX IF NOT EXISTS "trade_credit_facilities_organization_id_status_idx"
    ON "trade_credit_facilities"("organization_id", "status");

ALTER TABLE "trade_credit_facilities"
    ADD CONSTRAINT "trade_credit_facilities_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "trade_credit_facilities"
    ADD CONSTRAINT "trade_credit_facilities_counterparty_id_fkey"
    FOREIGN KEY ("counterparty_id") REFERENCES "counterparties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "trade_credit_grants" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "counterparty_id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "code_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "status" "TradeCreditGrantStatus" NOT NULL DEFAULT 'ISSUED',
    "issued_by_user_id" UUID,
    "issued_by_buyer" BOOLEAN NOT NULL DEFAULT false,
    "consumed_at" TIMESTAMPTZ(6),
    "consumed_ref_type" TEXT,
    "consumed_ref_id" TEXT,
    "override_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trade_credit_grants_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "trade_credit_grants_organization_id_code_hash_idx"
    ON "trade_credit_grants"("organization_id", "code_hash");

CREATE INDEX IF NOT EXISTS "trade_credit_grants_organization_id_counterparty_id_status_idx"
    ON "trade_credit_grants"("organization_id", "counterparty_id", "status");

ALTER TABLE "trade_credit_grants"
    ADD CONSTRAINT "trade_credit_grants_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "trade_credit_grants"
    ADD CONSTRAINT "trade_credit_grants_counterparty_id_fkey"
    FOREIGN KEY ("counterparty_id") REFERENCES "counterparties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "trade_credit_grants"
    ADD CONSTRAINT "trade_credit_grants_facility_id_fkey"
    FOREIGN KEY ("facility_id") REFERENCES "trade_credit_facilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "trade_credit_buyer_meter_snapshots" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "period_key" TEXT NOT NULL,
    "billed_buyer_count" INTEGER NOT NULL,
    "included_quota" INTEGER NOT NULL,
    "overage_count" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trade_credit_buyer_meter_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "trade_credit_buyer_meter_snapshots_organization_id_period_key_key"
    ON "trade_credit_buyer_meter_snapshots"("organization_id", "period_key");

ALTER TABLE "trade_credit_buyer_meter_snapshots"
    ADD CONSTRAINT "trade_credit_buyer_meter_snapshots_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
