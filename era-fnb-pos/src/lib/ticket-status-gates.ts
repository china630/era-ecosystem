/** Pure POS ticket mutation gates (AC-FNB-POS negative paths). */

export function ticketMutationBlockedReason(status: string): string | null {
  if (!["OPEN", "HELD"].includes(status)) {
    return `Ticket is ${status}`;
  }
  return null;
}
