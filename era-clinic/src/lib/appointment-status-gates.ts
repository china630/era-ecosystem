/** Pure appointment mutation gates (AC-CLI-OPS negative paths). */

export function appointmentCancelDenied(status: string): string | null {
  if (status === "COMPLETED") return "Cannot cancel a completed appointment";
  return null;
}

export function appointmentRescheduleDenied(status: string): string | null {
  if (status === "CANCELLED") return "Cannot reschedule a cancelled appointment";
  if (status === "COMPLETED") return "Cannot reschedule a completed appointment";
  if (status === "NO_SHOW") return "Cannot reschedule a no-show appointment";
  return null;
}
