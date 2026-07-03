-- Sanatorium clinical day: checkup gate, tenant scheduling settings, episode room

CREATE TYPE "ProgramSchedulingMode" AS ENUM ('ON_CHECKIN', 'AFTER_CHECKUP');
CREATE TYPE "ProcedureOverQuotaPolicy" AS ENUM ('CHARGE_FOLIO', 'BLOCK', 'WARN_ONLY');

ALTER TABLE "Tenant" ADD COLUMN "program_scheduling_mode" "ProgramSchedulingMode" NOT NULL DEFAULT 'AFTER_CHECKUP';
ALTER TABLE "Tenant" ADD COLUMN "scheduling_slot_minutes" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "Tenant" ADD COLUMN "procedure_over_quota_policy" "ProcedureOverQuotaPolicy" NOT NULL DEFAULT 'CHARGE_FOLIO';

ALTER TABLE "ClinicalEpisode" ADD COLUMN "checkupCompletedAt" TIMESTAMP(3);
ALTER TABLE "ClinicalEpisode" ADD COLUMN "roomNumber" TEXT;
