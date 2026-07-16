-- WS6: ProcurementProtocol + Bid (tender/quotation registry)

DO $enum$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProcurementProtocolStatus') THEN
    DO $do_ProcurementProtocolStatus$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProcurementProtocolStatus') THEN
    CREATE TYPE "ProcurementProtocolStatus" AS ENUM ('DRAFT', 'REGISTERED');
  END IF;
END
$do_ProcurementProtocolStatus$;
  END IF;
END $enum$;

CREATE TABLE IF NOT EXISTS "procurement_protocols" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "protocol_date" DATE NOT NULL,
    "procedure_type" VARCHAR(32) NOT NULL,
    "title" TEXT NOT NULL,
    "winner_counterparty_id" UUID,
    "contract_id" UUID,
    "status" "ProcurementProtocolStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "procurement_protocols_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "procurement_bids" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "protocol_id" UUID NOT NULL,
    "counterparty_id" UUID NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "is_winner" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "procurement_bids_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "procurement_protocols_organization_id_number_key"
  ON "procurement_protocols"("organization_id", "number");

CREATE INDEX IF NOT EXISTS "procurement_protocols_organization_id_status_protocol_date_idx"
  ON "procurement_protocols"("organization_id", "status", "protocol_date" DESC);

CREATE INDEX IF NOT EXISTS "procurement_bids_protocol_id_idx"
  ON "procurement_bids"("protocol_id");

CREATE INDEX IF NOT EXISTS "procurement_bids_counterparty_id_idx"
  ON "procurement_bids"("counterparty_id");

DO $fk$
BEGIN
  ALTER TABLE "procurement_protocols"
    ADD CONSTRAINT "procurement_protocols_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $fk$;

DO $fk2$
BEGIN
  ALTER TABLE "procurement_protocols"
    ADD CONSTRAINT "procurement_protocols_winner_counterparty_id_fkey"
    FOREIGN KEY ("winner_counterparty_id") REFERENCES "counterparties"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $fk2$;

DO $fk3$
BEGIN
  ALTER TABLE "procurement_protocols"
    ADD CONSTRAINT "procurement_protocols_contract_id_fkey"
    FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $fk3$;

DO $fk4$
BEGIN
  ALTER TABLE "procurement_bids"
    ADD CONSTRAINT "procurement_bids_protocol_id_fkey"
    FOREIGN KEY ("protocol_id") REFERENCES "procurement_protocols"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $fk4$;

DO $fk5$
BEGIN
  ALTER TABLE "procurement_bids"
    ADD CONSTRAINT "procurement_bids_counterparty_id_fkey"
    FOREIGN KEY ("counterparty_id") REFERENCES "counterparties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $fk5$;
