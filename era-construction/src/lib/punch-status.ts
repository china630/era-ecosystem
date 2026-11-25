/** Pure punch status transitions (Wave 3). No Prisma — safe for client CatalogField options. */

import { statusOptions } from "@/lib/status-options";

export const PUNCH_STATUS_TRANSITIONS: Record<string, readonly string[]> = {
  OPEN: ["FIXED"],
  FIXED: ["VERIFIED", "OPEN"],
  VERIFIED: [],
};

/** Current status plus legal next steps (for CatalogField options). */
export function punchStatusOptions(current: string): Array<{ value: string; label: string }> {
  return statusOptions(PUNCH_STATUS_TRANSITIONS, current);
}
