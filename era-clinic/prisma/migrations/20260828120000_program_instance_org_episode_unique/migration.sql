-- Tenant findUnique rewrite uses organizationId_episodeId. Keep episodeId @unique for 1:1.
CREATE UNIQUE INDEX IF NOT EXISTS "ProgramInstance_organizationId_episodeId_key"
  ON "ProgramInstance"("organization_id", "episodeId");
