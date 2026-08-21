/** Pure progress-act gates (AC-CON-PRJ negative paths). */

export function progressActReopenDenied(status: string): string | null {
  if (status === "APPROVED") return "Progress act is already approved";
  return null;
}
