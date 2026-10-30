-- Wave E: org-wide Layer A journal list (organizationId + createdAt)
CREATE INDEX IF NOT EXISTS "satellite_audit_logs_organizationId_createdAt_idx"
  ON "satellite_audit_logs"("organizationId", "created_at");
