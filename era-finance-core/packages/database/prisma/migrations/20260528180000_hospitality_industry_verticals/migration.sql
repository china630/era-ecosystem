-- Hospitality Nafta: add hotel-pms and fb-pos to Industry Solutions painted-door enum
ALTER TYPE "EarlyAccessModuleKey" ADD VALUE IF NOT EXISTS 'HOTEL_PMS';
ALTER TYPE "EarlyAccessModuleKey" ADD VALUE IF NOT EXISTS 'FB_POS';
