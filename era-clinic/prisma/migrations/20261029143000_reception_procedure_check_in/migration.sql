-- Reception may check in from resource matrix (Nafta default ON)

ALTER TABLE "Tenant"
  ADD COLUMN "reception_procedure_check_in" BOOLEAN NOT NULL DEFAULT true;
