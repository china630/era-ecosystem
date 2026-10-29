-- FIN-INV-SCOPE-01 progress + FNB-BUFFET-COST-01 Wave 5: warehouse cost class + satellite outlet scope.
ALTER TABLE "warehouses"
  ADD COLUMN IF NOT EXISTS "cost_class" TEXT,
  ADD COLUMN IF NOT EXISTS "satellite_outlet_code" TEXT;

CREATE INDEX IF NOT EXISTS "warehouses_org_cost_class_idx"
  ON "warehouses" ("organization_id", "cost_class");

CREATE INDEX IF NOT EXISTS "warehouses_org_outlet_code_idx"
  ON "warehouses" ("organization_id", "satellite_outlet_code");
