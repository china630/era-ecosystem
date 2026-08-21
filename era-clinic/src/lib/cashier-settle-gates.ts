/** Pure cashier settle gates (AC-CLI-CASH ops — not live KKM/fiscal). */

export function settleDenied(input: {
  visitFound: boolean;
  shiftStatus?: string | null;
  /** Live fiscal / KKM is out of scaffold scope — stub mode always allowed. */
  fiscalMode?: "stub" | "live";
}): string | null {
  if (!input.visitFound) return "Visit not found";
  if (input.shiftStatus && input.shiftStatus !== "OPEN") return "Shift is closed";
  if (input.fiscalMode === "live") {
    return "Live fiscal KKM not enabled in this edition (stub only)";
  }
  return null;
}
