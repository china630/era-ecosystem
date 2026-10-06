CREATE TABLE "satellite_role_catalog" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "satellite_key" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "satellite_role_catalog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "satellite_role_catalog_organization_id_satellite_key_code_key"
  ON "satellite_role_catalog"("organization_id", "satellite_key", "code");

CREATE INDEX "satellite_role_catalog_organization_id_satellite_key_active_idx"
  ON "satellite_role_catalog"("organization_id", "satellite_key", "active");

-- Explicit 1:1 aliases already used at provision time. STAFF is left unchanged:
-- hotel mapped it to Receptionist, retail to CASHIER, F&B to waiter.
UPDATE "satellite_role_templates" t
SET "satellite_role" = m.new_code
FROM (VALUES
  ('industry_hotel_pms', 'HOUSEKEEPING', 'Housekeeper'),
  ('industry_hotel_pms', 'RECEPTION', 'Receptionist'),
  ('industry_hotel_pms', 'MANAGER', 'Manager'),
  ('industry_hotel_pms', 'HOTEL_ADMIN', 'Hotel_Admin'),
  ('industry_hotel_pms', 'NIGHT_AUDITOR', 'NightAuditor'),
  ('industry_hotel_pms', 'DOCTOR', 'Doctor'),
  ('industry_hotel_pms', 'FINANCIAL_AUDITOR', 'Financial_Auditor'),
  ('industry_clinic', 'ADMIN', 'CLINIC_ADMIN'),
  ('industry_clinic', 'LAB', 'LAB_TECH'),
  ('industry_fnb_pos', 'WAITER', 'FB_WAITER'),
  ('industry_fnb_pos', 'CASHIER', 'FB_CASHIER'),
  ('industry_fnb_pos', 'CHEF', 'FB_KITCHEN'),
  ('industry_fnb_pos', 'KITCHEN', 'FB_KITCHEN'),
  ('industry_fnb_pos', 'MANAGER', 'FB_MANAGER'),
  ('industry_retail', 'SUPERVISOR', 'SHIFT_SUPERVISOR')
) AS m(satellite_key, old_code, new_code)
WHERE t."satellite_key" = m.satellite_key
  AND t."satellite_role" = m.old_code
  AND NOT EXISTS (
    SELECT 1 FROM "satellite_role_templates" o
    WHERE o."position_id" = t."position_id"
      AND o."satellite_key" = t."satellite_key"
      AND o."satellite_role" = m.new_code
  );

UPDATE "workforce_role_bindings" b
SET "satellite_role" = m.new_code
FROM (VALUES
  ('industry_hotel_pms', 'HOUSEKEEPING', 'Housekeeper'),
  ('industry_hotel_pms', 'RECEPTION', 'Receptionist'),
  ('industry_hotel_pms', 'MANAGER', 'Manager'),
  ('industry_hotel_pms', 'HOTEL_ADMIN', 'Hotel_Admin'),
  ('industry_hotel_pms', 'NIGHT_AUDITOR', 'NightAuditor'),
  ('industry_hotel_pms', 'DOCTOR', 'Doctor'),
  ('industry_hotel_pms', 'FINANCIAL_AUDITOR', 'Financial_Auditor'),
  ('industry_clinic', 'ADMIN', 'CLINIC_ADMIN'),
  ('industry_clinic', 'LAB', 'LAB_TECH'),
  ('industry_fnb_pos', 'WAITER', 'FB_WAITER'),
  ('industry_fnb_pos', 'CASHIER', 'FB_CASHIER'),
  ('industry_fnb_pos', 'CHEF', 'FB_KITCHEN'),
  ('industry_fnb_pos', 'KITCHEN', 'FB_KITCHEN'),
  ('industry_fnb_pos', 'MANAGER', 'FB_MANAGER'),
  ('industry_retail', 'SUPERVISOR', 'SHIFT_SUPERVISOR')
) AS m(satellite_key, old_code, new_code)
WHERE b."satellite_key" = m.satellite_key
  AND b."satellite_role" = m.old_code
  AND NOT EXISTS (
    SELECT 1 FROM "workforce_role_bindings" o
    WHERE o."employment_id" = b."employment_id"
      AND o."satellite_key" = b."satellite_key"
      AND o."satellite_role" = m.new_code
  );

UPDATE "workforce_manual_grants" g
SET "satellite_role" = m.new_code
FROM (VALUES
  ('industry_hotel_pms', 'HOUSEKEEPING', 'Housekeeper'),
  ('industry_hotel_pms', 'RECEPTION', 'Receptionist'),
  ('industry_hotel_pms', 'MANAGER', 'Manager'),
  ('industry_hotel_pms', 'HOTEL_ADMIN', 'Hotel_Admin'),
  ('industry_hotel_pms', 'NIGHT_AUDITOR', 'NightAuditor'),
  ('industry_hotel_pms', 'DOCTOR', 'Doctor'),
  ('industry_hotel_pms', 'FINANCIAL_AUDITOR', 'Financial_Auditor'),
  ('industry_clinic', 'ADMIN', 'CLINIC_ADMIN'),
  ('industry_clinic', 'LAB', 'LAB_TECH'),
  ('industry_fnb_pos', 'WAITER', 'FB_WAITER'),
  ('industry_fnb_pos', 'CASHIER', 'FB_CASHIER'),
  ('industry_fnb_pos', 'CHEF', 'FB_KITCHEN'),
  ('industry_fnb_pos', 'KITCHEN', 'FB_KITCHEN'),
  ('industry_fnb_pos', 'MANAGER', 'FB_MANAGER'),
  ('industry_retail', 'SUPERVISOR', 'SHIFT_SUPERVISOR')
) AS m(satellite_key, old_code, new_code)
WHERE g."satellite_key" = m.satellite_key
  AND g."satellite_role" = m.old_code;
