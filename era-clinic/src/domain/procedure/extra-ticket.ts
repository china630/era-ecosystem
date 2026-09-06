/** Dual-run extras → hotel Elektraweb outbox (per-org ClinicCutoverPolicy). */
export async function isClinicElektrawebDualRun(
  organizationId?: string | null,
): Promise<boolean> {
  const { isClinicElektrawebDualRun: fromPolicy } = await import(
    "@/domain/physio/clinic-cutover.service"
  );
  return fromPolicy(organizationId);
}

export function extraTicketIdForOrder(orderId: string): string {
  return `clinic-ticket-${orderId}`;
}

export function extraNeedsPaperTicket(input: {
  amountNet: number;
  packageIncluded?: boolean;
  /** CLI-57: prefer explicit inPackage over amountNet. */
  inPackage?: boolean;
}): boolean {
  if (input.inPackage === true) return false;
  if (input.inPackage === false) return true;
  const amount = Number(input.amountNet);
  // Legacy: free in-package lines need no ticket; over-quota charged package extras still do.
  if (input.packageIncluded === true && amount <= 0) return false;
  return amount > 0;
}
