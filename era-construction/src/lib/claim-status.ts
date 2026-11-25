import { statusOptions } from "@/lib/status-options";

/** Subcontractor claim ops statuses (money settle stays Finance). */
export const CLAIM_STATUS_TRANSITIONS: Record<string, readonly string[]> = {
  DRAFT: ["SUBMITTED", "CANCELLED"],
  SUBMITTED: ["APPROVED_OPS", "REJECTED"],
  APPROVED_OPS: [],
  REJECTED: [],
  CANCELLED: [],
};

export function claimStatusOptions(current: string) {
  return statusOptions(CLAIM_STATUS_TRANSITIONS, current);
}
