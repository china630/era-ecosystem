/**
 * Empty requested list = headcount hire (no satellite seat).
 * Never expand to all entitled modules.
 */
export function filterEntitledSatellites(
  entitled: string[],
  requested?: string[],
): string[] {
  if (!requested?.length) return [];
  const set = new Set(requested.map((k) => k.trim()).filter(Boolean));
  return entitled.filter((k) => set.has(k));
}

/** Seat + STAFF_PROVISIONED only when at least one satellite is requested and the person has none yet. */
export function shouldAllocateNewSeat(
  entitledKeys: string[],
  hasActiveSeat: boolean,
): boolean {
  return entitledKeys.length > 0 && !hasActiveSeat;
}

/** Roster `workplace=ADDITIONAL` never provisions a satellite login. */
export function rosterSatelliteKeys(workplace: string, satsRaw: string): string[] {
  if (workplace.trim().toUpperCase() === "ADDITIONAL") return [];
  return satsRaw
    .split(/[|;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

