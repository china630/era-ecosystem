-- ERP Channel Hub Phase 5: ops handoff kind (wholesale → retail first pair).
ALTER TYPE "SatelliteChannelKind" ADD VALUE IF NOT EXISTS 'OPS_HANDOFF';
