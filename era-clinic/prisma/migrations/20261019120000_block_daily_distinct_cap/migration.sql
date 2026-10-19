-- Per-block daily distinct SKU cap on the package line; drop clinic-wide tenant handle.
ALTER TABLE "ProgramTemplateProcedure" ADD COLUMN "daily_distinct_cap" INTEGER;

ALTER TABLE "Tenant" DROP COLUMN IF EXISTS "daily_package_procedure_cap";

CREATE TABLE "program_quota_transfer" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "from_code" TEXT NOT NULL,
    "to_quota_code" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "program_quota_transfer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "program_quota_transfer_instanceId_idx" ON "program_quota_transfer"("instanceId");
CREATE INDEX "program_quota_transfer_episodeId_idx" ON "program_quota_transfer"("episodeId");
CREATE INDEX "program_quota_transfer_organizationId_idx" ON "program_quota_transfer"("organizationId");

ALTER TABLE "program_quota_transfer" ADD CONSTRAINT "program_quota_transfer_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "ProgramInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
