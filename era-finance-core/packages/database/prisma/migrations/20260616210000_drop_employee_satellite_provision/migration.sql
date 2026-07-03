-- Plan C: satellite provisioning moved to CP; payroll Employee is mirror-only
ALTER TABLE "employees" DROP COLUMN IF EXISTS "provisioned_satellite_key";
ALTER TABLE "employees" DROP COLUMN IF EXISTS "provisioned_satellite_role";
