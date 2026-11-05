-- Package biochemistry panels accept a guest blank up to 30 days old.
-- The own-blank control on the course list keys off this column.
UPDATE "DiagnosticService"
SET "brought_in_max_days" = 30
WHERE "code" IN (
  'LAB-BIOCHEM-STANDART',
  'LAB-BIOCHEM-PREMIUM',
  'LAB-BIOCHEM-DERMA',
  'LAB-BIOCHEM-DETOKS',
  'LAB-BIOCHEM-INFECT'
)
AND "brought_in_max_days" IS NULL;
