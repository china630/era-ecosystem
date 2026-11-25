import type { StaffSession } from "@/lib/api-utils";
import { runWithConstructionTenant } from "../bridge";
import type { ConstructionRequest } from "./session";

/** Run domain work under the satellite tenant. */
export function withStaffTenant<T>(
  req: ConstructionRequest,
  session: StaffSession,
  fn: () => Promise<T>,
): Promise<T> {
  return runWithConstructionTenant(session, fn);
}
