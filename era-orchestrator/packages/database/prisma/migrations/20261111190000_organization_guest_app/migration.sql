-- Guest phone brand. Separate from letterhead organization_profiles.
CREATE TABLE "organization_guest_apps" (
    "organization_id" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "display_name" TEXT,
    "primary_color" VARCHAR(7),
    "logo_url" TEXT,
    "locale" VARCHAR(2),
    "desk_phone" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "organization_guest_apps_pkey" PRIMARY KEY ("organization_id")
);

ALTER TABLE "organization_guest_apps" ADD CONSTRAINT "organization_guest_apps_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
