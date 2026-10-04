-- WS-RBAC-01 (Variant A): system role packages + matrix audit.
ALTER TABLE "Role" ADD COLUMN IF NOT EXISTS "is_system" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Role" ADD COLUMN IF NOT EXISTS "clone_from_code" TEXT;
ALTER TABLE "Role" ADD COLUMN IF NOT EXISTS "permission_catalog_version" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "satellite_audit_logs" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "user_id" TEXT,
  "entity_type" TEXT NOT NULL,
  "entity_id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "changes_json" TEXT NOT NULL DEFAULT '{}',
  "ip_address" TEXT,
  "integrity_hash" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "satellite_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "satellite_audit_logs_organization_id_idx" ON "satellite_audit_logs"("organization_id");
CREATE INDEX IF NOT EXISTS "satellite_audit_logs_entity_type_entity_id_idx" ON "satellite_audit_logs"("entity_type", "entity_id");
CREATE INDEX IF NOT EXISTS "satellite_audit_logs_created_at_idx" ON "satellite_audit_logs"("created_at");
