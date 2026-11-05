-- Organization payment method catalog (SoR next to fiscal KKM / BANK_POS).
CREATE TABLE "org_payment_methods" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "name_az" VARCHAR(120) NOT NULL,
    "name_ru" VARCHAR(120) NOT NULL,
    "name_en" VARCHAR(120) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "system_key" VARCHAR(64),
    "fiscal_hint" VARCHAR(16) NOT NULL DEFAULT 'NONE',
    "fiscal_device_id" UUID,
    "satellites_json" JSONB NOT NULL DEFAULT '[]',
    "secrets_cipher" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "org_payment_methods_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "org_payment_methods_organization_id_code_key" ON "org_payment_methods"("organization_id", "code");
CREATE INDEX "org_payment_methods_organization_id_active_idx" ON "org_payment_methods"("organization_id", "active");

ALTER TABLE "org_payment_methods"
  ADD CONSTRAINT "org_payment_methods_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "org_payment_methods"
  ADD CONSTRAINT "org_payment_methods_fiscal_device_id_fkey"
  FOREIGN KEY ("fiscal_device_id") REFERENCES "fiscal_hardware_devices"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
