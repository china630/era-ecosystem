-- Platform-wide CRM KV (integrations KEK, etc.)

CREATE TABLE "crm_system_config" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_system_config_pkey" PRIMARY KEY ("key")
);
