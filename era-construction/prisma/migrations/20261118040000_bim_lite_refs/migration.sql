-- Wave B1: BIM lite element refs on punch + RFI (ops only)

ALTER TABLE "PunchListItem" ADD COLUMN IF NOT EXISTS "ifc_element_id" VARCHAR(128);
ALTER TABLE "PunchListItem" ADD COLUMN IF NOT EXISTS "external_viewer_url" VARCHAR(512);

ALTER TABLE "Rfi" ADD COLUMN IF NOT EXISTS "ifc_element_id" VARCHAR(128);
ALTER TABLE "Rfi" ADD COLUMN IF NOT EXISTS "external_viewer_url" VARCHAR(512);
