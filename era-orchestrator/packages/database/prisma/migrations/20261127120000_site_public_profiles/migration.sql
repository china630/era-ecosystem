-- Public site catalog profiles (products, modules, industries)

CREATE TYPE "SiteCatalogVisibility" AS ENUM ('VISIBLE', 'HIDDEN', 'DRAFT');
CREATE TYPE "SiteCatalogMaturity" AS ENUM ('prod', 'pilot');
CREATE TYPE "SiteIndustryItemRole" AS ENUM ('C', 'I', 'O');

CREATE TABLE "satellite_public_profiles" (
    "satellite_key" TEXT NOT NULL,
    "public_slug" TEXT NOT NULL,
    "visibility" "SiteCatalogVisibility" NOT NULL DEFAULT 'VISIBLE',
    "maturity" "SiteCatalogMaturity" NOT NULL DEFAULT 'prod',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "names" JSONB NOT NULL DEFAULT '{}',
    "descriptions" JSONB NOT NULL DEFAULT '{}',
    "tagline" JSONB NOT NULL DEFAULT '{}',
    "body" JSONB NOT NULL DEFAULT '{}',
    "image_url" TEXT,
    "show_on_site" BOOLEAN NOT NULL DEFAULT true,
    "kind" TEXT NOT NULL DEFAULT 'industry',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "satellite_public_profiles_pkey" PRIMARY KEY ("satellite_key")
);

CREATE TABLE "pricing_module_public_profiles" (
    "module_key" TEXT NOT NULL,
    "visibility" "SiteCatalogVisibility" NOT NULL DEFAULT 'VISIBLE',
    "maturity" "SiteCatalogMaturity",
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "names" JSONB NOT NULL DEFAULT '{}',
    "descriptions" JSONB NOT NULL DEFAULT '{}',
    "tagline" JSONB NOT NULL DEFAULT '{}',
    "body" JSONB NOT NULL DEFAULT '{}',
    "image_url" TEXT,
    "show_as_subsection" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pricing_module_public_profiles_pkey" PRIMARY KEY ("module_key")
);

CREATE TABLE "site_industries" (
    "slug" TEXT NOT NULL,
    "visibility" "SiteCatalogVisibility" NOT NULL DEFAULT 'VISIBLE',
    "maturity_override" "SiteCatalogMaturity",
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "names" JSONB NOT NULL DEFAULT '{}',
    "descriptions" JSONB NOT NULL DEFAULT '{}',
    "tagline" JSONB NOT NULL DEFAULT '{}',
    "body" JSONB NOT NULL DEFAULT '{}',
    "image_url" TEXT,
    "calc_prefill" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_industries_pkey" PRIMARY KEY ("slug")
);

CREATE TABLE "site_industry_items" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "industry_slug" TEXT NOT NULL,
    "satellite_key" TEXT NOT NULL,
    "module_key" TEXT NOT NULL DEFAULT '',
    "role" "SiteIndustryItemRole" NOT NULL DEFAULT 'I',
    "assumed" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_industry_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "satellite_public_profiles_public_slug_key" ON "satellite_public_profiles"("public_slug");
CREATE INDEX "satellite_public_profiles_visibility_sort_order_idx" ON "satellite_public_profiles"("visibility", "sort_order");
CREATE INDEX "pricing_module_public_profiles_visibility_sort_order_idx" ON "pricing_module_public_profiles"("visibility", "sort_order");
CREATE INDEX "site_industries_visibility_sort_order_idx" ON "site_industries"("visibility", "sort_order");
CREATE INDEX "site_industry_items_industry_slug_sort_order_idx" ON "site_industry_items"("industry_slug", "sort_order");
CREATE UNIQUE INDEX "site_industry_items_industry_slug_satellite_key_module_key_key" ON "site_industry_items"("industry_slug", "satellite_key", "module_key");

ALTER TABLE "satellite_public_profiles" ADD CONSTRAINT "satellite_public_profiles_satellite_key_fkey" FOREIGN KEY ("satellite_key") REFERENCES "satellites"("key") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pricing_module_public_profiles" ADD CONSTRAINT "pricing_module_public_profiles_module_key_fkey" FOREIGN KEY ("module_key") REFERENCES "pricing_modules"("key") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "site_industry_items" ADD CONSTRAINT "site_industry_items_industry_slug_fkey" FOREIGN KEY ("industry_slug") REFERENCES "site_industries"("slug") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "site_industry_items" ADD CONSTRAINT "site_industry_items_satellite_key_fkey" FOREIGN KEY ("satellite_key") REFERENCES "satellites"("key") ON DELETE RESTRICT ON UPDATE CASCADE;
