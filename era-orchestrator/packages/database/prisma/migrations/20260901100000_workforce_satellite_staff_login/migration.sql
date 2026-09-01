-- CP workforce: optional satellite staff login + PIN override (provision/reprovision SSOT).
ALTER TABLE workforce_employments
  ADD COLUMN IF NOT EXISTS satellite_staff_login VARCHAR(64),
  ADD COLUMN IF NOT EXISTS satellite_staff_pin VARCHAR(32);
