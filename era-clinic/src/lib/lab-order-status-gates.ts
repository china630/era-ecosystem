/** Pure lab-order lifecycle gates (AC-CLI-LAB ops — not HL7). */

const PUBLISHABLE = new Set(["RESULT_READY"]);
const RESULT_ENTRY = new Set(["COLLECTED", "IN_PROGRESS", "RESULT_READY"]);
const RESULT_CORRECTION = new Set(["COMPLETED", "PUBLISHED"]);

export function labPublishDenied(status: string, hasResults: boolean): string | null {
  if (!PUBLISHABLE.has(status)) {
    return `Cannot publish from status ${status}`;
  }
  if (!hasResults) return "Results required before publish";
  return null;
}

export function labCollectDenied(status: string): string | null {
  if (status !== "ORDERED") return `Cannot collect from status ${status}`;
  return null;
}

/** First entry and correction of a published or completed order. ORDERED and CANCELLED stay closed. */
export function labResultsDenied(status: string): string | null {
  if (RESULT_ENTRY.has(status) || RESULT_CORRECTION.has(status)) return null;
  return `Cannot enter results from status ${status}`;
}

/** Correction keeps COMPLETED / PUBLISHED. A first entry still advances to RESULT_READY. */
export function labResultsPreservePublication(status: string): boolean {
  return RESULT_CORRECTION.has(status);
}

export function labCompleteDenied(status: string): string | null {
  if (status === "COMPLETED") return null; // idempotent
  if (status !== "PUBLISHED") {
    return `Complete requires PUBLISHED status (current: ${status})`;
  }
  return null;
}
