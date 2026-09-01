import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  authCookieName,
  getBearerOrCookieToken,
  verifySatelliteSession,
} from "@era/satellite-kit";
import {
  resolveSessionPermissions,
  hasClinicPermissionBypass,
} from "@/lib/auth/clinic-permission-check";
import { ALL_CLINIC_PERMISSIONS } from "@/lib/auth/clinic-permissions";
import { firstAllowedAdminHref } from "@/domain/nav/clinic-nav";

export default async function AdminIndexPage() {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const token = getBearerOrCookieToken(
    cookieStore,
    headerStore,
    authCookieName(),
  );
  if (!token) redirect("/login");

  let permissions: string[] = [];
  try {
    const session = await verifySatelliteSession(token);
    if (hasClinicPermissionBypass(session)) {
      permissions = [...ALL_CLINIC_PERMISSIONS];
    } else {
      permissions = resolveSessionPermissions({
        role: session.role,
        roles: session.roles,
        permissions: session.permissions,
      });
    }
  } catch {
    redirect("/login");
  }

  const href = firstAllowedAdminHref(permissions);
  redirect(href ?? "/?error=forbidden");
}
