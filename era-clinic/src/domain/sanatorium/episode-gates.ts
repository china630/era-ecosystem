/**
 * CLI-55 episode / course gates (pure helpers + shared error codes).
 * Canon: docs/adr/clinic-episode-as-clinical-course.md
 */

export const ANAMNESIS_REQUIRED = "ANAMNESIS_REQUIRED";
export const WALK_IN_OPEN_EXISTS = "WALK_IN_OPEN_EXISTS";
export const EPISODE_CLOSED = "EPISODE_CLOSED";
export const EPISODE_NOT_IDLE = "EPISODE_NOT_IDLE";
export const NO_OPEN_EPISODE = "NO_OPEN_EPISODE";

export function episodeAnamnesisDenied(
  anamnesisText: string | null | undefined,
): string | null {
  if (anamnesisText != null && String(anamnesisText).trim()) return null;
  return "Anamnesis is required before assigning or confirming procedures";
}

export function episodeWriteDenied(status: string | null | undefined): string | null {
  if (!status) return "Episode not found";
  if (status !== "OPEN") return "Closed episode is read-only";
  return null;
}

/** Live procedure statuses that block walk-in close. */
export const LIVE_PROCEDURE_STATUSES = [
  "PROPOSED",
  "SCHEDULED",
  "CHECKED_IN",
] as const;
/** PENDING_PAY is purged on episode close — not a close blocker. */

/** Open lab statuses that block walk-in close. */
export const OPEN_LAB_STATUSES = ["ORDERED", "COLLECTED", "IN_PROGRESS"] as const;

export function walkInCloseDenied(input: {
  liveProcedureCount: number;
  openLabCount: number;
}): string | null {
  if (input.liveProcedureCount > 0 || input.openLabCount > 0) {
    return "Cannot close episode while live procedures or open labs remain";
  }
  return null;
}
