import type { ProcedureOrderStatus } from "@prisma/client";

/**
 * Nurse bonus attribution: guest was checked in and the procedure was (or is being)
 * executed. CANCELLED / NO_SHOW never earn bonus even if checkedInAt was set then voided.
 */
export function qualifiesForNurseBonus(order: {
  checkedInAt: Date | null;
  status: ProcedureOrderStatus | string;
}): boolean {
  if (!order.checkedInAt) return false;
  return order.status === "CHECKED_IN" || order.status === "COMPLETED";
}
