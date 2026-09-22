-- Satellite catalog templates (ADR clinic-catalog-template-overlay).
-- Backfill from existing org-scoped rows (DISTINCT ON code) so Nafta keeps overlay.

CREATE TABLE IF NOT EXISTS "modality_template" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "title_en" TEXT NOT NULL,
  "title_ru" TEXT NOT NULL,
  "title_az" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "modality_template_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "modality_template_code_key" ON "modality_template"("code");

CREATE TABLE IF NOT EXISTS "diagnostic_service_template" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "modality_id" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT '',
  "kind" TEXT NOT NULL,
  "title_en" TEXT NOT NULL,
  "title_ru" TEXT NOT NULL,
  "title_az" TEXT NOT NULL,
  "service_code" TEXT NOT NULL,
  "fields_json" TEXT,
  "includes_json" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "diagnostic_service_template_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "diagnostic_service_template_code_key" ON "diagnostic_service_template"("code");
CREATE INDEX IF NOT EXISTS "diagnostic_service_template_modality_id_idx" ON "diagnostic_service_template"("modality_id");
CREATE INDEX IF NOT EXISTS "diagnostic_service_template_kind_idx" ON "diagnostic_service_template"("kind");

CREATE TABLE IF NOT EXISTS "diagnostic_analyte_template" (
  "id" TEXT NOT NULL,
  "service_id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "unit" TEXT,
  "label_en" TEXT NOT NULL,
  "label_ru" TEXT NOT NULL,
  "label_az" TEXT NOT NULL,
  "ref_min" TEXT,
  "ref_max" TEXT,
  "section" TEXT,
  "value_type" "AnalyteValueType" NOT NULL DEFAULT 'NUMERIC',
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "diagnostic_analyte_template_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "diagnostic_analyte_template_service_id_code_key"
  ON "diagnostic_analyte_template"("service_id", "code");
CREATE INDEX IF NOT EXISTS "diagnostic_analyte_template_service_id_idx"
  ON "diagnostic_analyte_template"("service_id");

DO $$ BEGIN
  ALTER TABLE "diagnostic_service_template"
    ADD CONSTRAINT "diagnostic_service_template_modality_id_fkey"
    FOREIGN KEY ("modality_id") REFERENCES "modality_template"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "diagnostic_analyte_template"
    ADD CONSTRAINT "diagnostic_analyte_template_service_id_fkey"
    FOREIGN KEY ("service_id") REFERENCES "diagnostic_service_template"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "physio_site_template" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "prikaz_817" INTEGER,
  "laterality" BOOLEAN NOT NULL DEFAULT false,
  "title_az" TEXT NOT NULL,
  "title_ru" TEXT NOT NULL,
  "title_en" TEXT NOT NULL,
  "title_la" TEXT NOT NULL,
  "boundary" TEXT,
  "coarse" TEXT[],
  "anatomy_json" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "physio_site_template_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "physio_site_template_code_key" ON "physio_site_template"("code");
CREATE INDEX IF NOT EXISTS "physio_site_template_active_sort_order_idx"
  ON "physio_site_template"("active", "sort_order");

CREATE TABLE IF NOT EXISTS "physio_list_item_template" (
  "id" TEXT NOT NULL,
  "list_kind" "PhysioListKind" NOT NULL,
  "code" TEXT NOT NULL,
  "title_az" TEXT NOT NULL,
  "title_ru" TEXT NOT NULL,
  "title_en" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "physio_list_item_template_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "physio_list_item_template_list_kind_code_key"
  ON "physio_list_item_template"("list_kind", "code");
CREATE INDEX IF NOT EXISTS "physio_list_item_template_list_kind_active_idx"
  ON "physio_list_item_template"("list_kind", "active");

-- Backfill modality templates from first org that has each code.
INSERT INTO "modality_template" (
  "id", "code", "kind", "title_en", "title_ru", "title_az", "sort_order", "active", "createdAt", "updatedAt"
)
SELECT
  'mtpl_' || md5(m.code),
  m.code,
  m.kind,
  m."title_en",
  m."title_ru",
  m."title_az",
  m."sort_order",
  m.active,
  NOW(),
  NOW()
FROM (
  SELECT DISTINCT ON (code) *
  FROM "Modality"
  ORDER BY code, "sort_order" ASC
) m
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "diagnostic_service_template" (
  "id", "code", "modality_id", "category", "kind", "title_en", "title_ru", "title_az",
  "service_code", "fields_json", "includes_json", "sort_order", "active", "createdAt", "updatedAt"
)
SELECT
  'dstpl_' || md5(s.code),
  s.code,
  mt.id,
  s.category,
  s.kind,
  s."title_en",
  s."title_ru",
  s."title_az",
  s."service_code",
  s."fields_json",
  s."includes_json",
  s."sort_order",
  s.active,
  NOW(),
  NOW()
FROM (
  SELECT DISTINCT ON (ds.code) ds.*, m.code AS modality_code
  FROM "DiagnosticService" ds
  JOIN "Modality" m ON m.id = ds."modality_id"
  ORDER BY ds.code, ds."sort_order" ASC
) s
JOIN "modality_template" mt ON mt.code = s.modality_code
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "diagnostic_analyte_template" (
  "id", "service_id", "code", "unit", "label_en", "label_ru", "label_az",
  "ref_min", "ref_max", "section", "value_type", "sort_order"
)
SELECT
  'datpl_' || md5(dst.id || ':' || a.code),
  dst.id,
  a.code,
  a.unit,
  a."label_en",
  a."label_ru",
  a."label_az",
  a."ref_min",
  a."ref_max",
  a.section,
  a."value_type",
  a."sort_order"
FROM (
  SELECT DISTINCT ON (ds.code, da.code) da.*, ds.code AS service_code
  FROM "DiagnosticAnalyte" da
  JOIN "DiagnosticService" ds ON ds.id = da."service_id"
  ORDER BY ds.code, da.code, da."sort_order" ASC
) a
JOIN "diagnostic_service_template" dst ON dst.code = a.service_code
ON CONFLICT ("service_id", "code") DO NOTHING;

INSERT INTO "physio_site_template" (
  "id", "code", "kind", "prikaz_817", "laterality", "title_az", "title_ru", "title_en", "title_la",
  "boundary", "coarse", "anatomy_json", "active", "sort_order", "created_at", "updated_at"
)
SELECT
  'pstpl_' || md5(p.code),
  p.code,
  p.kind,
  p."prikaz_817",
  p.laterality,
  p."title_az",
  p."title_ru",
  p."title_en",
  p."title_la",
  p.boundary,
  p.coarse,
  p."anatomy_json",
  p.active,
  p."sort_order",
  NOW(),
  NOW()
FROM (
  SELECT DISTINCT ON (code) *
  FROM "physio_site"
  ORDER BY code, "sort_order" ASC
) p
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "physio_list_item_template" (
  "id", "list_kind", "code", "title_az", "title_ru", "title_en", "active", "sort_order", "created_at", "updated_at"
)
SELECT
  'plitpl_' || md5(p."list_kind"::text || ':' || p.code),
  p."list_kind",
  p.code,
  p."title_az",
  p."title_ru",
  p."title_en",
  p.active,
  p."sort_order",
  NOW(),
  NOW()
FROM (
  SELECT DISTINCT ON ("list_kind", code) *
  FROM "physio_list_item"
  ORDER BY "list_kind", code, "sort_order" ASC
) p
ON CONFLICT ("list_kind", "code") DO NOTHING;
