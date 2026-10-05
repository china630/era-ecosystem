-- Soft-retire departments. Existing rows stay active. Linked prices keep the code.

ALTER TABLE "service_department" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
