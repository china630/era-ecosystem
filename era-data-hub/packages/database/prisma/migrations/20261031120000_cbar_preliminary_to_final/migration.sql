-- Unchanged CBAR values are official. PRELIMINARY was a false "value equals yesterday" flag.
UPDATE "cbar_official_rates"
SET "status" = 'FINAL'
WHERE "status" = 'PRELIMINARY';
