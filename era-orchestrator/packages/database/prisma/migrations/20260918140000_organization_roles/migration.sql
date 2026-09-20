-- Wave 4: org-scoped CP roles (Variant A)
CREATE TABLE IF NOT EXISTS "organization_roles" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "clone_from_code" TEXT,
    "permissions_json" TEXT NOT NULL DEFAULT '[]',
    "permission_catalog_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "organization_roles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "organization_roles_organization_id_code_key" ON "organization_roles"("organization_id", "code");
CREATE INDEX IF NOT EXISTS "organization_roles_organization_id_idx" ON "organization_roles"("organization_id");

DO $$ BEGIN
  ALTER TABLE "organization_roles" ADD CONSTRAINT "organization_roles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "organization_memberships" ADD COLUMN IF NOT EXISTS "organization_role_id" UUID;
CREATE INDEX IF NOT EXISTS "organization_memberships_organization_role_id_idx" ON "organization_memberships"("organization_role_id");

DO $$ BEGIN
  ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_organization_role_id_fkey" FOREIGN KEY ("organization_role_id") REFERENCES "organization_roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "organization_invites" ADD COLUMN IF NOT EXISTS "organization_role_code" TEXT;
