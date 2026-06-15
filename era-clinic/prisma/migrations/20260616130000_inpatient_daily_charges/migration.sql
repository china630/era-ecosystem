CREATE TABLE IF NOT EXISTS "inpatient_daily_charges" (
  "id" TEXT NOT NULL,
  "admission_id" TEXT NOT NULL,
  "charge_date" DATE NOT NULL,
  "emitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inpatient_daily_charges_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "inpatient_daily_charges_admission_id_charge_date_key"
  ON "inpatient_daily_charges"("admission_id", "charge_date");

ALTER TABLE "inpatient_daily_charges" ADD CONSTRAINT "inpatient_daily_charges_admission_id_fkey"
  FOREIGN KEY ("admission_id") REFERENCES "InpatientAdmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
