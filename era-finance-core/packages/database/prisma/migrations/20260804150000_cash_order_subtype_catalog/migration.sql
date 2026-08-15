-- A6: CashOrder subtypes → String + T1 catalog table
ALTER TABLE "cash_orders" ALTER COLUMN "pko_subtype" TYPE TEXT USING "pko_subtype"::text;
ALTER TABLE "cash_orders" ALTER COLUMN "rko_subtype" TYPE TEXT USING "rko_subtype"::text;

DROP TYPE IF EXISTS "CashOrderPkoSubtype";
DROP TYPE IF EXISTS "CashOrderRkoSubtype";

CREATE TYPE "CashOrderSubtypeDirection" AS ENUM ('PKO', 'RKO');

CREATE TABLE "cash_order_subtypes" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "organization_id" UUID NOT NULL,
  "direction" "CashOrderSubtypeDirection" NOT NULL,
  "code" TEXT NOT NULL,
  "name_az" TEXT NOT NULL,
  "name_ru" TEXT NOT NULL,
  "name_en" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "system_key" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cash_order_subtypes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cash_order_subtypes_organization_id_direction_code_key"
  ON "cash_order_subtypes"("organization_id", "direction", "code");

CREATE INDEX "cash_order_subtypes_organization_id_direction_active_sort_order_idx"
  ON "cash_order_subtypes"("organization_id", "direction", "active", "sort_order");

ALTER TABLE "cash_order_subtypes"
  ADD CONSTRAINT "cash_order_subtypes_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
