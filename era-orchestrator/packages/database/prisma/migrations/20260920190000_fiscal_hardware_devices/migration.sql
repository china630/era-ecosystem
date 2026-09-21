-- Fiscal hardware devices (N KKM + bank POS per org) for @era/fiscal kit
CREATE TABLE IF NOT EXISTS "fiscal_hardware_devices" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "kind" VARCHAR(32) NOT NULL,
    "provider_id" VARCHAR(64) NOT NULL,
    "label" VARCHAR(200) NOT NULL,
    "outlet_code" VARCHAR(64),
    "register_code" VARCHAR(64),
    "serial" VARCHAR(128),
    "external_ids_json" JSONB,
    "endpoint" VARCHAR(512),
    "secrets_cipher" TEXT,
    "status" VARCHAR(16) NOT NULL DEFAULT 'active',
    "is_org_default" BOOLEAN NOT NULL DEFAULT false,
    "is_outlet_default" BOOLEAN NOT NULL DEFAULT false,
    "is_register_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fiscal_hardware_devices_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "fiscal_hardware_devices_organization_id_kind_status_idx"
  ON "fiscal_hardware_devices"("organization_id", "kind", "status");
CREATE INDEX IF NOT EXISTS "fiscal_hardware_devices_organization_id_outlet_code_idx"
  ON "fiscal_hardware_devices"("organization_id", "outlet_code");

DO $$ BEGIN
  ALTER TABLE "fiscal_hardware_devices"
    ADD CONSTRAINT "fiscal_hardware_devices_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
