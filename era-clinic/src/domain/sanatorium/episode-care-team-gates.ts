/**
 * CLI-56 episode care team (pure helpers + error codes).
 * Canon: docs/adr/clinic-episode-care-team.md
 */

export const CARE_TEAM_REQUIRED = "CARE_TEAM_REQUIRED";

export function episodeCareTeamDenied(memberCount: number): string | null {
  if (memberCount > 0) return null;
  return "Assign at least one doctor to this course before clinical work";
}
