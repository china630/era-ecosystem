-- Extend EarlyAccessModuleKey for auto STO, clinic, wholesale
ALTER TYPE "EarlyAccessModuleKey" ADD VALUE IF NOT EXISTS 'AUTO_STO';
ALTER TYPE "EarlyAccessModuleKey" ADD VALUE IF NOT EXISTS 'CLINIC';
ALTER TYPE "EarlyAccessModuleKey" ADD VALUE IF NOT EXISTS 'WHOLESALE';
