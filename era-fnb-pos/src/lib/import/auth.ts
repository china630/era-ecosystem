import { sessionIsPlatformSuperAdmin } from "@era/satellite-kit";
import { assertFnbEntitled } from "@/lib/api-utils";
import { getSessionFromRequest } from "@/lib/session";
import { sessionHasFnbPermission } from "@/lib/auth/permission-check";
import { PERMISSIONS } from "@/lib/auth/permissions";

export type FnbImportAccess = {
  userId: string;
  via: "platform_super_admin" | "manager";
};

/** Elektraweb cutover import — platform super-admin or IMPORT_CUTOVER grant. */
export async function assertFnbImportAccess(request: Request): Promise<FnbImportAccess> {
  await assertFnbEntitled();
  const session = await getSessionFromRequest(request);
  if (!session) throw new Error("Unauthorized");

  // PIN till sessions never import (even if a custom role somehow got the key).
  if (session.pin === true) {
    throw new Error("Forbidden: PIN session cannot run cutover import");
  }

  if (sessionIsPlatformSuperAdmin(session)) {
    return { userId: session.sub, via: "platform_super_admin" };
  }

  const allowed = sessionHasFnbPermission(
    {
      login: session.login,
      email: session.email,
      role: session.role,
      permissions: session.permissions,
      isOwner: session.isOwner,
      pin: session.pin,
    },
    PERMISSIONS.IMPORT_CUTOVER,
  );
  if (!allowed) {
    throw new Error(
      "Forbidden: import requires platform super-admin or IMPORT_CUTOVER",
    );
  }
  return { userId: session.sub, via: "manager" };
}
