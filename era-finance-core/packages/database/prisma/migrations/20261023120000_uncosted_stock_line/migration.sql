CREATE TABLE "uncosted_stock_lines" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "business_date" DATE NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "sku" TEXT NOT NULL,
    "quantity" DECIMAL(19,4) NOT NULL,
    "debit_account_code" TEXT NOT NULL,
    "inventory_account_code" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "uncosted_stock_lines_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "uncosted_stock_lines_organization_id_resolved_at_idx" ON "uncosted_stock_lines"("organization_id", "resolved_at");

ALTER TABLE "uncosted_stock_lines" ADD CONSTRAINT "uncosted_stock_lines_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
