-- Per-org satellite endpoint registry for orchestrator event fan-out

CREATE TABLE "satellite_endpoints" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "satellite_key" TEXT NOT NULL,
    "base_url" TEXT NOT NULL,
    "secret_cipher" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "satellite_endpoints_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "satellite_endpoints_organization_id_satellite_key_key" ON "satellite_endpoints"("organization_id", "satellite_key");
CREATE INDEX "satellite_endpoints_organization_id_idx" ON "satellite_endpoints"("organization_id");

ALTER TABLE "satellite_endpoints" ADD CONSTRAINT "satellite_endpoints_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "satellite_endpoints" ADD CONSTRAINT "satellite_endpoints_satellite_key_fkey" FOREIGN KEY ("satellite_key") REFERENCES "satellites"("key") ON DELETE SET NULL ON UPDATE CASCADE;
