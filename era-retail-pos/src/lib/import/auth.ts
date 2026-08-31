import {
  authCookieName,
  getBearerOrCookieToken,
  sessionHasRole,
  sessionIsPlatformSuperAdmin,
  verifySatelliteSession,
} from "@era/satellite-kit";
import { cookies, headers } from "next/headers";
import { assertRetailEntitled } from "@/lib/api-utils";

export type RetailImportAccess = {
  userId: string;
  via: "platform_super_admin" | "outlet_admin";
};

const OWNER_ROLES = new Set([
  "OUTLET_ADMIN",
  "SHIFT_SUPERVISOR",
  "BUSINESS_OWNER",
  "OWNER",
  "DIRECTOR",
]);

/** Elektraweb cutover import — platform super-admin or outlet admin. */
export async function assertRetailImportAccess(): Promise<RetailImportAccess> {
  await assertRetailEntitled();

  let cookieStore: Awaited<ReturnType<typeof cookies>>;
  let headerStore: Awaited<ReturnType<typeof headers>>;
  try {
    cookieStore = await cookies();
    headerStore = await headers();
  } catch {
    throw new Error("Unauthorized");
  }

  const token = getBearerOrCookieToken(cookieStore, headerStore, authCookieName());
  if (!token) throw new Error("Unauthorized");

  const session = await verifySatelliteSession(token);
  if (sessionIsPlatformSuperAdmin(session)) {
    return { userId: session.sub, via: "platform_super_admin" };
  }

  const allowed =
    [...OWNER_ROLES].some((role) => sessionHasRole(session, role)) ||
    session.isOwner === true;
  if (!allowed) {
    throw new Error("Forbidden: import requires platform super-admin or outlet admin");
  }
  return { userId: session.sub, via: "outlet_admin" };
}
