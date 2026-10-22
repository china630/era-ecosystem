export const WALK_IN_PARTY_STATUSES = ["DRAFT", "SENT_TO_CASHIER", "PAID"] as const;

export type WalkInPartyStatus = (typeof WALK_IN_PARTY_STATUSES)[number];

export function nextPartyStatus(input: {
  receiptRef: string | null;
  unpaidCount: number;
}): WalkInPartyStatus {
  if (!input.receiptRef) return "DRAFT";
  if (input.unpaidCount > 0) return "SENT_TO_CASHIER";
  return "PAID";
}

/** Placeholder card name until a real given name or surname is typed. */
export function guestPlaceholderName(sortOrder: number): string {
  return `Guest ${sortOrder}`;
}

export function isGuestPlaceholder(fullName: string, sortOrder: number): boolean {
  return fullName.trim() === guestPlaceholderName(sortOrder);
}
