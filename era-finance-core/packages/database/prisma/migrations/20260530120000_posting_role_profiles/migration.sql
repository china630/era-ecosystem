-- Posting role profiles: semantic roles → NAS account codes per OrganizationKind.

CREATE TABLE "template_posting_roles" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "kind" "OrganizationKind" NOT NULL,
    "role" TEXT NOT NULL,
    "account_code" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "template_posting_roles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "template_posting_roles_kind_role_key" ON "template_posting_roles"("kind", "role");
CREATE INDEX "template_posting_roles_kind_idx" ON "template_posting_roles"("kind");

CREATE TABLE "organization_posting_roles" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "account_code" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "organization_posting_roles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "organization_posting_roles_org_role_key" ON "organization_posting_roles"("organization_id", "role");
CREATE INDEX "organization_posting_roles_organization_id_idx" ON "organization_posting_roles"("organization_id");

ALTER TABLE "organization_posting_roles" ADD CONSTRAINT "organization_posting_roles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
