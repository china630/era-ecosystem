/**
 * Hotel PlacementJob curated slice models (Wave 11).
 * Ordered FK-safe: role → user → guest.
 * Backlog: reservation (+ roomType/ratePlan graph), folio, outbox — expand later.
 */
export const HOTEL_PLACEMENT_SLICE_MODEL_ORDER = [
  "role",
  "user",
  "guest",
] as const;

export type HotelPlacementSliceModel =
  (typeof HOTEL_PLACEMENT_SLICE_MODEL_ORDER)[number];
