-- Unscoped lab analyte dictionary (no organizationId). Panel rows stay org-scoped copies.

CREATE TABLE "analyte_dictionary" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "unit" TEXT,
    "label_en" TEXT NOT NULL,
    "label_ru" TEXT NOT NULL,
    "label_az" TEXT NOT NULL,
    "ref_min" TEXT,
    "ref_max" TEXT,
    "section" TEXT,
    "value_type" "AnalyteValueType" NOT NULL DEFAULT 'NUMERIC',
    "options_json" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "analyte_dictionary_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "analyte_dictionary_code_key" ON "analyte_dictionary"("code");
CREATE INDEX "analyte_dictionary_active_idx" ON "analyte_dictionary"("active");
