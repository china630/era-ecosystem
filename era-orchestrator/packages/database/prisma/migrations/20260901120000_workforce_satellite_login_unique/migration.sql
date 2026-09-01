-- Backfill default logins for active employments before uniqueness constraint.
UPDATE workforce_employments
SET satellite_staff_login = 'emp-' || lower(substring(replace(id::text, '-', ''), 1, 8))
WHERE status = 'ACTIVE'
  AND satellite_staff_login IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS workforce_employments_org_login_active_uq
  ON workforce_employments (organization_id, lower(satellite_staff_login))
  WHERE status = 'ACTIVE' AND satellite_staff_login IS NOT NULL;
