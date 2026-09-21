-- Evrostar Wave 7: PENDING_MANUAL / SUBMITTED_MANUAL + audit actor on EmasContractEvent

ALTER TYPE "EmasContractEventStatus" ADD VALUE IF NOT EXISTS 'PENDING_MANUAL';
ALTER TYPE "EmasContractEventStatus" ADD VALUE IF NOT EXISTS 'SUBMITTED_MANUAL';

ALTER TABLE "emas_contract_events"
  ADD COLUMN IF NOT EXISTS "submitted_by_user_id" UUID;
