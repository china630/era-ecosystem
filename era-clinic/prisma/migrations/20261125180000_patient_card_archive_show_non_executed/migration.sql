-- Closed-course Plan/print archive: show CANCELLED/NO_SHOW by default (Nafta audit).
ALTER TABLE "Tenant"
ADD COLUMN "patient_card_archive_show_non_executed" BOOLEAN NOT NULL DEFAULT true;
