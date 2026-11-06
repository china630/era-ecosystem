/** Industry sats that may post folio / settlement to hotel. */
export const CHANNEL_HOTEL_BRIDGE_FROM = [
  "industry_clinic",
  "industry_fnb_pos",
  "industry_retail",
] as const;

export const CHANNEL_HOTEL_KEY = "industry_hotel_pms";
export const CHANNEL_FINANCE_KEY = "finance_core";

/**
 * Explicit OPS_HANDOFF PLATFORM pairs (not full mesh).
 * Gate assert lands at the first real S2S call site.
 */
export const CHANNEL_OPS_HANDOFF_PAIRS = [
  {
    fromSatelliteKey: "industry_wholesale",
    toSatelliteKey: "industry_retail",
  },
] as const;

export type ChannelHotelBridgeFrom =
  (typeof CHANNEL_HOTEL_BRIDGE_FROM)[number];
