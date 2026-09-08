-- Wave B: management-book accounts need a truthful ledger discriminator.
ALTER TYPE "LedgerType" ADD VALUE IF NOT EXISTS 'MANAGEMENT';
