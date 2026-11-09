-- Turn the Elektra hall on for the Nafta café outlets that use it.
UPDATE "outlets"
SET "hall_mode" = true
WHERE upper("code") IN ('XUDMANI', 'DISCO');
