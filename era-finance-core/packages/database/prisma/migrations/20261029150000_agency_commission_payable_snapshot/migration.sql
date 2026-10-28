-- Hotel agency commission payable snapshots (AP). ADR hotel-agency-commission-payable.

CREATE TABLE "agency_commission_payable_snapshots" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "organization_id" UUID NOT NULL,
  "hotel_agency_id" TEXT NOT NULL,
  "agency_code" TEXT NOT NULL,
  "hotel_batch_id" TEXT NOT NULL,
  "as_of_date" TEXT NOT NULL,
  "total_amount" DECIMAL(18,2) NOT NULL,
  "line_count" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'AZN',
  "correlation_id" TEXT NOT NULL,
  "counterparty_id" UUID,
  "payable_txn_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "agency_commission_payable_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "agency_comm_pay_snap_org_batch_uidx"
  ON "agency_commission_payable_snapshots"("organization_id", "hotel_batch_id");

CREATE INDEX "agency_comm_pay_snap_org_agency_date_idx"
  ON "agency_commission_payable_snapshots"("organization_id", "hotel_agency_id", "as_of_date");

CREATE INDEX "agency_comm_pay_snap_org_cp_idx"
  ON "agency_commission_payable_snapshots"("organization_id", "counterparty_id");

ALTER TABLE "agency_commission_payable_snapshots"
  ADD CONSTRAINT "agency_commission_payable_snapshots_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "agency_commission_payable_snapshots"
  ADD CONSTRAINT "agency_commission_payable_snapshots_counterparty_id_fkey"
  FOREIGN KEY ("counterparty_id") REFERENCES "counterparties"("id") ON DELETE SET NULL ON UPDATE CASCADE;
