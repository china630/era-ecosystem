-- AlterTable
ALTER TABLE "ClinicalEpisode" ADD COLUMN IF NOT EXISTS "package_apply_misses" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "satellite_audit_log_archives" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "user_id" TEXT,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "changes_json" TEXT NOT NULL DEFAULT '{}',
    "ip_address" TEXT,
    "integrity_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "satellite_audit_log_archives_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "satellite_audit_log_archives_organizationId_created_at_idx" ON "satellite_audit_log_archives"("organizationId", "created_at");
CREATE INDEX IF NOT EXISTS "satellite_audit_log_archives_entity_type_entity_id_idx" ON "satellite_audit_log_archives"("entity_type", "entity_id");
