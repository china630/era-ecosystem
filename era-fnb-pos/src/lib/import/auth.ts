import { sessionHasRole, sessionIsPlatformSuperAdmin } from "@era/satellite-kit";
import { assertFnbEntitled } from "@/lib/api-utils";
import { FB_ROLES, getSessionFromRequest } from "@/lib/session";

export type FnbImportAccess = {
  userId: string;
  via: "platform_super_admin" | "manager";
};

const OWNER_ROLES = new Set([
  FB_ROLES.MANAGER,
  "BUSINESS_OWNER",
  "OWNER",
  "DIRECTOR",
]);

/** Elektraweb cutover import — platform super-admin or F&B manager. */
export async function assertFnbImportAccess(request: Request): Promise<FnbImportAccess> {
  await assertFnbEntitled();
  const session = await getSessionFromRequest(request);
  if (!session) throw new Error("Unauthorized");

  if (sessionIsPlatformSuperAdmin(session)) {
    return { userId: session.sub, via: "platform_super_admin" };
  }

  const allowed =
    [...OWNER_ROLES].some((role) => sessionHasRole(session, role)) ||
    session.isOwner === true;
  if (!allowed) {
    throw new Error("Forbidden: import requires platform super-admin or F&B manager");
  }
  return { userId: session.sub, via: "manager" };
}
