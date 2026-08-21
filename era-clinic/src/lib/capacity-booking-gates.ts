/** Pure capacity foresight gates (AC-CLI-CAP). */

export function capacityBookingDenied(input: {
  bookingAllowed: boolean;
  riskLevel?: string;
}): string | null {
  if (input.bookingAllowed) return null;
  return `Clinic capacity booking blocked (risk=${input.riskLevel ?? "critical"})`;
}

export function assertCapacityBookingAllowed(input: {
  bookingAllowed: boolean;
  riskLevel?: string;
}): void {
  const reason = capacityBookingDenied(input);
  if (reason) throw new Error(reason);
}
