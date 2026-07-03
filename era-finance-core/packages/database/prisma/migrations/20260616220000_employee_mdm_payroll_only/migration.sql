-- Plan D: Finance Employee = payroll extension only; person identity in MDM.
ALTER TABLE employees DROP COLUMN IF EXISTS fin_code;
ALTER TABLE employees DROP COLUMN IF EXISTS first_name;
ALTER TABLE employees DROP COLUMN IF EXISTS last_name;
ALTER TABLE employees DROP COLUMN IF EXISTS fin_code_cipher;
ALTER TABLE employees DROP COLUMN IF EXISTS fin_code_blind_index;
ALTER TABLE employees DROP COLUMN IF EXISTS first_name_cipher;
ALTER TABLE employees DROP COLUMN IF EXISTS last_name_cipher;
ALTER TABLE employees DROP COLUMN IF EXISTS passport_number_cipher;
ALTER TABLE employees DROP COLUMN IF EXISTS provisioned_satellite_key;
ALTER TABLE employees DROP COLUMN IF EXISTS provisioned_satellite_role;

DROP INDEX IF EXISTS employees_org_fin_blind_uidx;

ALTER TABLE employees ALTER COLUMN global_person_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS employees_org_global_person_uidx
  ON employees (organization_id, global_person_id);
