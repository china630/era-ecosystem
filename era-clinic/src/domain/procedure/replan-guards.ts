import type { ProcedureOrderStatus } from "@prisma/client";

/** Rows the engine must never pick as replan candidates. */
export function isReplanImmovable(input: {
  status: ProcedureOrderStatus;
  scheduledAt: Date;
  now: Date;
  manuallyAdjusted: boolean;
  respectPins: boolean;
}): boolean {
  if (["CHECKED_IN", "COMPLETED", "NO_SHOW", "CANCELLED"].includes(input.status)) {
    return true;
  }
  if (input.scheduledAt.getTime() < input.now.getTime()) return true;
  if (input.respectPins && input.manuallyAdjusted) return true;
  return false;
}
