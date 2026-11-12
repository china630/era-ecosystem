-- Own-blank date belongs on infection biochemistry, not the package blood panels.
UPDATE "DiagnosticService"
SET "brought_in_max_days" = NULL
WHERE "code" IN (
  'LAB-BIOCHEM-STANDART',
  'LAB-BIOCHEM-PREMIUM',
  'LAB-BIOCHEM-DERMA',
  'LAB-BIOCHEM-DETOKS'
);

UPDATE "DiagnosticService"
SET "brought_in_max_days" = 30
WHERE "code" = 'LAB-BIOCHEM-INFECT';
