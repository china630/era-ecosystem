/**
 * Display-only CODE_LEGACY bridge hints for /admin/links.
 * Never enables a gate — empty until OPS_HANDOFF (or other) call sites exist.
 */
export type ChannelLegacyHint = {
  fromSatelliteKey: string;
  toSatelliteKey: string;
  kind: string;
  note: string;
};

/**
 * Display-only CODE_LEGACY rows. Never enables a gate.
 * Auto→hotel FOLIO waits a room-charge client; OPS_HANDOFF assert waits first S2S call.
 */
export const CHANNEL_LEGACY_HINTS: readonly ChannelLegacyHint[] = [
  {
    fromSatelliteKey: "industry_auto_service",
    toSatelliteKey: "industry_hotel_pms",
    kind: "FOLIO_POST",
    note: "No auto room-charge client yet — FOLIO PLATFORM edge not desired until call site exists",
  },
];
