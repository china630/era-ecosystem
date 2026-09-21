-- White-label login hosts (B1): kind + satellite_key, global hostname unique.
-- ADR: docs/adr/org-public-number-and-login-host.md

CREATE TYPE "PlatformCustomDomainKind" AS ENUM ('portal', 'satellite_login');

ALTER TABLE "platform_custom_domains"
  ADD COLUMN IF NOT EXISTS "kind" "PlatformCustomDomainKind" NOT NULL DEFAULT 'portal',
  ADD COLUMN IF NOT EXISTS "satellite_key" VARCHAR(64);

UPDATE "platform_custom_domains" SET "kind" = 'portal' WHERE "kind" IS NULL;

DROP INDEX IF EXISTS "platform_custom_domains_organization_id_hostname_key";

CREATE UNIQUE INDEX IF NOT EXISTS "platform_custom_domains_hostname_key"
  ON "platform_custom_domains"("hostname");

CREATE INDEX IF NOT EXISTS "platform_custom_domains_organization_id_idx"
  ON "platform_custom_domains"("organization_id");
