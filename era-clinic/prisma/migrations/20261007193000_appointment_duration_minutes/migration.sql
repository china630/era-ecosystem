-- Reception length lives on the appointment. Existing rows keep the doctor's old slot.

ALTER TABLE "Appointment" ADD COLUMN "duration_minutes" INTEGER;

UPDATE "Appointment" AS a
SET "duration_minutes" = COALESCE(p."default_slot_minutes", 30)
FROM "Practitioner" AS p
WHERE p.id = a."practitionerId";

UPDATE "Appointment"
SET "duration_minutes" = 30
WHERE "duration_minutes" IS NULL;

ALTER TABLE "Appointment" ALTER COLUMN "duration_minutes" SET DEFAULT 30;
ALTER TABLE "Appointment" ALTER COLUMN "duration_minutes" SET NOT NULL;
