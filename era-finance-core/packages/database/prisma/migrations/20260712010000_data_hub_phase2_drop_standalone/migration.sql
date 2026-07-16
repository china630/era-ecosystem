-- Data-Hub Phase 2: drop Finance standalone SoR tables (no inbound FK).
-- Hub-sync cache tables (UnitOfMeasure, TaxRate, BankGlossary, BankBranch, Country, City) kept.

DROP TABLE IF EXISTS "cbar_official_rates";
DROP TABLE IF EXISTS "customs_tariff_rates";
DROP TABLE IF EXISTS "global_company_directory";

DO $migration$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CbarRateStatus') THEN
    DROP TYPE "CbarRateStatus";
  END IF;
END
$migration$;
