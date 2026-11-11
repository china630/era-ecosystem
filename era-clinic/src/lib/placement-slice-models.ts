/**
 * @deprecated Curated clinic slice lists are interim only.
 * Product path = OrgFullSliceV2 via `buildDelegatesFromPrismaClient` + DMMF.
 */
export const CLINIC_PLACEMENT_SLICE_MODEL_ORDER = [
  "role",
  "user",
  "patientRef",
] as const;

export type ClinicPlacementSliceModel =
  (typeof CLINIC_PLACEMENT_SLICE_MODEL_ORDER)[number];

/** @deprecated Prefer OrgFullSliceV2.objectStorage stub/manifest. */
export const CLINIC_PLACEMENT_DEFERRED_PREFIXES = [
  "object-storage",
] as const;
