-- Hall mode (Xudmani / Disco): limit holders, tender snapshot, X-report hides.

ALTER TABLE "outlets"
  ADD COLUMN IF NOT EXISTS "hall_mode" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "x_report_hidden" JSONB;

ALTER TABLE "tickets"
  ADD COLUMN IF NOT EXISTS "tender_route" TEXT,
  ADD COLUMN IF NOT EXISTS "card_terminal_label" TEXT,
  ADD COLUMN IF NOT EXISTS "limit_holder_id" TEXT,
  ADD COLUMN IF NOT EXISTS "limit_balance_after" DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "room_number_label" TEXT;

CREATE TABLE IF NOT EXISTS "fnb_limit_holders" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "outlet_id" TEXT,
  "display_name" TEXT NOT NULL,
  "ceiling_azn" DECIMAL(12,2) NOT NULL,
  "used_azn" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "fnb_limit_holders_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "fnb_limit_holders_organization_id_active_idx"
  ON "fnb_limit_holders"("organization_id", "active");
CREATE INDEX IF NOT EXISTS "fnb_limit_holders_outlet_id_idx"
  ON "fnb_limit_holders"("outlet_id");

DO $$ BEGIN
  ALTER TABLE "fnb_limit_holders"
    ADD CONSTRAINT "fnb_limit_holders_outlet_id_fkey"
    FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
