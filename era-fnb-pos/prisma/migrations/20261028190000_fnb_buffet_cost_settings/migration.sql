-- Buffet cost attribution settings (Wave 1). ADR: docs/adr/fnb-buffet-cost-attribution.md
ALTER TABLE "fnb_org_profiles" ADD COLUMN "buffet_cost_settings_json" JSONB;
