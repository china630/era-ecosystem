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
}): boolean {
  const amount = Number(input.amountNet);
  if (input.packageIncluded && amount <= 0) return false;
  return amount > 0;
}
