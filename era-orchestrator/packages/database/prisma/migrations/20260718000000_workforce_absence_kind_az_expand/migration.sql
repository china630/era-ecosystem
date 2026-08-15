-- Expand WorkforceAbsenceKind to the full Azerbaijan Labour Code leave set.
-- Idempotent ADD VALUE (PG 10+); safe on re-run and existing rows keep their kind.
ALTER TYPE "WorkforceAbsenceKind" ADD VALUE IF NOT EXISTS 'SOCIAL_LEAVE';
ALTER TYPE "WorkforceAbsenceKind" ADD VALUE IF NOT EXISTS 'EDUCATIONAL_LEAVE';
ALTER TYPE "WorkforceAbsenceKind" ADD VALUE IF NOT EXISTS 'BUSINESS_TRIP';
ALTER TYPE "WorkforceAbsenceKind" ADD VALUE IF NOT EXISTS 'ADMINISTRATIVE';