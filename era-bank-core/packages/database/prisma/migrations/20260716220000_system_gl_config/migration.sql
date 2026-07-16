-- CreateTable
CREATE TABLE "system_gl_configs" (
    "id" TEXT NOT NULL,
    "bank_org_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "gl_code" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_gl_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "system_gl_configs_bank_org_id_idx" ON "system_gl_configs"("bank_org_id");

-- CreateIndex
CREATE UNIQUE INDEX "system_gl_configs_bank_org_id_key_key" ON "system_gl_configs"("bank_org_id", "key");
