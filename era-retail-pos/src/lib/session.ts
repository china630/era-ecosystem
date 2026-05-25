import { headers } from "next/headers";
import { sessionHasRole } from "@era/satellite-kit";

export type RequestSession = {
  sub: string;
  role: string;
};

export async function getRequestSession(): Promise<RequestSession | null> {
  const h = await headers();
  const sub = h.get("x-user-id");
  const role = h.get("x-user-role");
  if (!sub || !role) return null;
  return { sub, role };
}

const VOID_LINE_ROLES = ["SHIFT_SUPERVISOR", "OUTLET_ADMIN"] as const;

export function canVoidLine(session: RequestSession): boolean {
  return VOID_LINE_ROLES.some((role) => sessionHasRole(session, role));
}
