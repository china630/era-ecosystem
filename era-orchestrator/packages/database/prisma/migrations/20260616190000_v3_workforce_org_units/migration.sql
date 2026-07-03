-- v3 Plan B: CP workforce org structure (OrgUnit, Position, Scope)

CREATE TYPE "OrgUnitStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "OrgCommercialLinkMode" AS ENUM ('SCOPE_ROOT', 'SUBTREE');

CREATE TABLE "workforce_scopes" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "anchor_organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "workforce_scopes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "workforce_scopes_anchor_organization_id_key" ON "workforce_scopes"("anchor_organization_id");

CREATE TABLE "org_units" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "workforce_scope_id" UUID NOT NULL,
    "parent_id" UUID,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "status" "OrgUnitStatus" NOT NULL DEFAULT 'ACTIVE',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "manager_employment_id" UUID,
    "manager_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "org_units_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "org_unit_commercial_links" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "workforce_scope_id" UUID NOT NULL,
    "org_unit_id" UUID,
    "link_mode" "OrgCommercialLinkMode" NOT NULL DEFAULT 'SCOPE_ROOT',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "org_unit_commercial_links_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "org_unit_commercial_links_organization_id_key" ON "org_unit_commercial_links"("organization_id");

CREATE TABLE "workforce_positions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "org_unit_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "total_slots" INTEGER NOT NULL DEFAULT 1,
    "status" "OrgUnitStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "workforce_positions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "org_units_workforce_scope_id_parent_id_name_key" ON "org_units"("workforce_scope_id", "parent_id", "name");
CREATE INDEX "org_units_workforce_scope_id_parent_id_idx" ON "org_units"("workforce_scope_id", "parent_id");
CREATE UNIQUE INDEX "workforce_positions_org_unit_id_name_key" ON "workforce_positions"("org_unit_id", "name");

ALTER TABLE "org_units" ADD CONSTRAINT "org_units_workforce_scope_id_fkey"
  FOREIGN KEY ("workforce_scope_id") REFERENCES "workforce_scopes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "org_units" ADD CONSTRAINT "org_units_parent_id_fkey"
  FOREIGN KEY ("parent_id") REFERENCES "org_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "org_unit_commercial_links" ADD CONSTRAINT "org_unit_commercial_links_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "org_unit_commercial_links" ADD CONSTRAINT "org_unit_commercial_links_workforce_scope_id_fkey"
  FOREIGN KEY ("workforce_scope_id") REFERENCES "workforce_scopes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "org_unit_commercial_links" ADD CONSTRAINT "org_unit_commercial_links_org_unit_id_fkey"
  FOREIGN KEY ("org_unit_id") REFERENCES "org_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "workforce_positions" ADD CONSTRAINT "workforce_positions_org_unit_id_fkey"
  FOREIGN KEY ("org_unit_id") REFERENCES "org_units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Upgrade workforce_employments (empty DB clean cut — add NOT NULL columns with bootstrap requirement)
ALTER TABLE "workforce_employments"
  ADD COLUMN "workforce_scope_id" UUID,
  ADD COLUMN "org_unit_id" UUID,
  ADD COLUMN "position_id" UUID,
  ADD COLUMN "commercial_organization_id" UUID,
  ADD COLUMN "platform_user_id" UUID;

CREATE INDEX "workforce_employments_workforce_scope_id_org_unit_id_idx" ON "workforce_employments"("workforce_scope_id", "org_unit_id");

ALTER TABLE "workforce_employments" ADD CONSTRAINT "workforce_employments_workforce_scope_id_fkey"
  FOREIGN KEY ("workforce_scope_id") REFERENCES "workforce_scopes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workforce_employments" ADD CONSTRAINT "workforce_employments_org_unit_id_fkey"
  FOREIGN KEY ("org_unit_id") REFERENCES "org_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "workforce_employments" ADD CONSTRAINT "workforce_employments_position_id_fkey"
  FOREIGN KEY ("position_id") REFERENCES "workforce_positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "org_units" ADD CONSTRAINT "org_units_manager_employment_id_fkey"
  FOREIGN KEY ("manager_employment_id") REFERENCES "workforce_employments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
