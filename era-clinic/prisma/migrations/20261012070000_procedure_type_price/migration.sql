CREATE TABLE "procedure_type_prices" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "procedure_type_id" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "effective_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "procedure_type_prices_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "procedure_type_prices_procedure_type_id_effective_from_idx" ON "procedure_type_prices"("procedure_type_id", "effective_from");
CREATE INDEX "procedure_type_prices_organizationId_idx" ON "procedure_type_prices"("organizationId");

ALTER TABLE "procedure_type_prices" ADD CONSTRAINT "procedure_type_prices_procedure_type_id_fkey" FOREIGN KEY ("procedure_type_id") REFERENCES "ProcedureType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
