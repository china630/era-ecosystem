-- Wave E: org-wide Layer A journal list (organizationId + createdAt)
-- F&B maps organizationId → organization_id
CREATE INDEX IF NOT EXISTS "satellite_audit_logs_organizationId_createdAt_idx"
  ON "satellite_audit_logs"("organization_id", "created_at");
