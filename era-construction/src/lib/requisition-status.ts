import { statusOptions } from "@/lib/status-options";

export const REQUISITION_STATUS_TRANSITIONS: Record<string, readonly string[]> = {
  DRAFT: ["SUBMITTED", "CANCELLED"],
  SUBMITTED: ["FULFILLED", "CANCELLED"],
  FULFILLED: [],
  CANCELLED: [],
};

export function requisitionStatusOptions(current: string) {
  return statusOptions(REQUISITION_STATUS_TRANSITIONS, current);
}
