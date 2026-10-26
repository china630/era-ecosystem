-- One active manual grant per employment + satellite + role.
-- Keep the row the role binding already points at; otherwise the newest active row.
-- Bindings and provisioning are left untouched (do not call revoke).

WITH active AS (
  SELECT
    g.id,
    g.employment_id,
    g.satellite_key,
    g.satellite_role,
    g.created_at,
    b.manual_grant_id
  FROM workforce_manual_grants g
  LEFT JOIN workforce_role_bindings b
    ON b.employment_id = g.employment_id
   AND b.satellite_key = g.satellite_key
   AND b.satellite_role = g.satellite_role
  WHERE g.revoked_at IS NULL
),
keepers AS (
  SELECT DISTINCT ON (employment_id, satellite_key, satellite_role)
    id
  FROM active
  ORDER BY
    employment_id,
    satellite_key,
    satellite_role,
    (id = manual_grant_id) DESC NULLS LAST,
    created_at DESC,
    id DESC
)
UPDATE workforce_manual_grants g
SET revoked_at = CURRENT_TIMESTAMP
FROM active a
WHERE g.id = a.id
  AND NOT EXISTS (SELECT 1 FROM keepers k WHERE k.id = g.id);

CREATE UNIQUE INDEX IF NOT EXISTS workforce_manual_grants_one_active
  ON workforce_manual_grants (employment_id, satellite_key, satellite_role)
  WHERE revoked_at IS NULL;
