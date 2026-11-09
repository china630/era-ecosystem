CREATE TABLE "organization_access_credentials" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "connector_code" VARCHAR(40) NOT NULL,
    "public_fields" JSONB NOT NULL DEFAULT '{}',
    "secret_cipher" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "organization_access_credentials_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "organization_access_credentials_organization_id_connector_code_key" ON "organization_access_credentials"("organization_id", "connector_code");

CREATE INDEX "organization_access_credentials_organization_id_idx" ON "organization_access_credentials"("organization_id");

ALTER TABLE "organization_access_credentials" ADD CONSTRAINT "organization_access_credentials_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
