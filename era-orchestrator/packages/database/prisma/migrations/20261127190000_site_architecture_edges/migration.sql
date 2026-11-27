-- Site architecture integration map edges (public diagram)

ALTER TYPE "SiteCatalogMaturity" ADD VALUE IF NOT EXISTS 'in_development';

CREATE TYPE "SiteArchitectureEdgeKind" AS ENUM (
    'REVENUE_EVENT',
    'FOLIO_POST',
    'SETTLEMENT',
    'LIFECYCLE',
    'OPS_HANDOFF',
    'STAFF_PROVISION',
    'CRM_PARTY',
    'REFERENCE_DATA',
    'ANALYTICS',
    'READ_STATUS',
    'PLATFORM_IDENTITY',
    'BANK_CHANNEL'
);

CREATE TYPE "SiteArchitectureRealizationStatus" AS ENUM ('live', 'partial', 'planned');

CREATE TABLE "satellite_links" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "from_key" TEXT NOT NULL,
    "to_key" TEXT NOT NULL,
    "kind" "SiteArchitectureEdgeKind" NOT NULL,
    "realization_status" "SiteArchitectureRealizationStatus" NOT NULL,
    "labels" JSONB NOT NULL DEFAULT '{}',
    "visibility" "SiteCatalogVisibility" NOT NULL DEFAULT 'VISIBLE',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "auto_managed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "satellite_links_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "satellite_links_from_key_to_key_kind_key" ON "satellite_links"("from_key", "to_key", "kind");
CREATE INDEX "satellite_links_visibility_sort_order_idx" ON "satellite_links"("visibility", "sort_order");