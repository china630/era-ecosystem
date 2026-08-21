/** Pure work-order mutation gates (AC-AUTO-WO negative paths). */

export function workOrderMutationDenied(status: string): string | null {
  if (status === "COMPLETED") return "Work order is closed";
  return null;
}
