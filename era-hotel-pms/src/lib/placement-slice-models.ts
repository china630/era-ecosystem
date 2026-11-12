/**
 * @deprecated Curated hotel slice lists are interim only.
 * Product path = OrgFullSliceV2 via `buildDelegatesFromPrismaClient` + DMMF.
 * Kept for lab/fixture references until callers are removed.
 */
export const HOTEL_PLACEMENT_SLICE_MODEL_ORDER = [
  "role",
  "user",
  "guest",
  "roomType",
  "mealPlan",
  "ratePlan",
  "room",
] as const;

export type HotelPlacementSliceModel =
  (typeof HOTEL_PLACEMENT_SLICE_MODEL_ORDER)[number];

/** @deprecated Object-storage is declared on OrgFullSliceV2.objectStorage (stub until copy hook). */
export const HOTEL_PLACEMENT_DEFERRED_PREFIXES = [
  "object-storage",
  "satellite-audit-log",
] as const;
