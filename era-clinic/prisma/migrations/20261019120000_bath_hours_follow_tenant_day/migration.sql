-- Baths use the clinic day (09:00–17:00). Sex-split AM/PM windows are not product law.
UPDATE "ProcedureType"
SET
  "day_start_hour" = NULL,
  "day_end_hour" = NULL,
  "afterLunchAllowed" = TRUE,
  "before_lunch_allowed" = TRUE
WHERE code IN (
  'SVC-NAFTALAN-VANNASI-QADIN',
  'SVC-NAFTALAN-VANNASI-KISI',
  'SVC-APLIKASIYA-NAFTALAN-QADIN',
  'SVC-APLIKASIYA-NAFTALAN-KISI',
  'SVC-4-KAMERALI-NAFTALAN-VANNASI',
  'SVC-4-KAMERALI-HIDROQALVANIZASIYA'
);
