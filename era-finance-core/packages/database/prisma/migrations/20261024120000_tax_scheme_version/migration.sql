-- Dated statutory tax scheme (one published row, orgs do not copy it)
-- and a population tag on card-tender journal lines.

CREATE TABLE "tax_scheme_versions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "code" TEXT NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "parameters" JSONB NOT NULL,
    "name_az" TEXT NOT NULL,
    "name_ru" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tax_scheme_versions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tax_scheme_versions_code_effective_from_key" ON "tax_scheme_versions"("code", "effective_from");
CREATE INDEX "tax_scheme_versions_effective_from_idx" ON "tax_scheme_versions"("effective_from");

INSERT INTO "tax_scheme_versions" (
    "id",
    "code",
    "effective_from",
    "parameters",
    "name_az",
    "name_ru",
    "name_en"
) VALUES (
    'a1b2c3d4-e5f6-4789-a012-3456789abcde',
    'AZ_STATUTORY',
    '2020-01-01',
    '{
      "vatThresholdAzn": "200000",
      "posCoefficient": "0.5",
      "eqaimeShareLimit": "0.30",
      "defaultSimplifiedPercent": "2",
      "posSimplifiedPercent": "6",
      "posRateEffectiveFrom": "2026-01-01",
      "posRateEffectiveTo": "2028-12-31",
      "vatPercent": "18"
    }'::jsonb,
    'Azərbaycan vergi sxemi',
    'Налоговая схема Азербайджана',
    'Azerbaijan statutory tax scheme'
);

CREATE TABLE "tax_settlement_tags" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "journal_entry_id" UUID NOT NULL,
    "population" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tax_settlement_tags_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tax_settlement_tags_journal_entry_id_key" ON "tax_settlement_tags"("journal_entry_id");
CREATE INDEX "tax_settlement_tags_organization_id_idx" ON "tax_settlement_tags"("organization_id");

ALTER TABLE "tax_settlement_tags"
    ADD CONSTRAINT "tax_settlement_tags_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tax_settlement_tags"
    ADD CONSTRAINT "tax_settlement_tags_journal_entry_id_fkey"
    FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
