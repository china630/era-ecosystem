-- Goods bought without an act stay in expense. The later credit moves that net onto inventory.

ALTER TABLE "provisional_vat_claims"
  ADD COLUMN "net_goods_amount" DECIMAL(19, 4) NOT NULL DEFAULT 0;
