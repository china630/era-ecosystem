/** Cabin sex vs guest sex. ANY accepts every guest. Unknown guest sex only fits ANY. */
export function cabinMatchesGuest(
  audience: "MALE" | "FEMALE" | "ANY" | null | undefined,
  guestSex: string | null | undefined,
): boolean {
  if (!audience || audience === "ANY") return true;
  if (guestSex !== "MALE" && guestSex !== "FEMALE") return false;
  return audience === guestSex;
}
