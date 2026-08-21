/** Pure lab-order lifecycle gates (AC-CLI-LAB ops — not HL7). */

const PUBLISHABLE = new Set(["RESULT_READY"]);

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

export function labCompleteDenied(status: string): string | null {
  if (status === "COMPLETED") return null; // idempotent
  if (status !== "PUBLISHED") {
    return `Complete requires PUBLISHED status (current: ${status})`;
  }
  return null;
}
