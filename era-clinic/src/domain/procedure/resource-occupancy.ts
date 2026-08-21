/**
 * Pure resource occupancy with per-type cabin idle after endsAt.
 * ADR: clinic-scheduling-time-layers — occupying tail model.
 */

/** Does booking [bookStart, bookEnd + resourceGap) overlap candidate [candStart, candEnd)? */
export function allocationOccupiesCandidate(
  bookStart: Date,
  bookEnd: Date,
  resourceGapMinutes: number,
  candStart: Date,
  candEnd: Date,
): boolean {
  const gap = Math.max(0, resourceGapMinutes);
  const occupiedEnd = new Date(bookEnd.getTime() + gap * 60_000);
  return bookStart < candEnd && occupiedEnd > candStart;
}

/** Patient rest layer: template may only raise rest above type default. */
export function effectivePatientRestMinutes(
  templateGap: number | null | undefined,
  patientRestMinutes: number,
): number {
  return Math.max(templateGap ?? 0, patientRestMinutes);
}
