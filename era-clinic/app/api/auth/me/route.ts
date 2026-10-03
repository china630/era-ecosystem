import { jsonError, jsonOk, handleRouteError, getSatelliteSession } from "@/lib/api-utils";
import { hasClinicPermissionBypass } from "@/lib/auth/clinic-admin-access";
import { resolveSessionPermissions } from "@/lib/auth/clinic-permission.service";
import { ALL_CLINIC_PERMISSIONS } from "@/lib/auth/clinic-permissions";
import { isPlatformSuperAdminUser } from "@/lib/auth/platform-super-admin";
import { getEnabledPresets } from "@/domain/settings/settings.service";
import {
  PRESETS_COOKIE,
  serializePresetsCookie,
} from "@/domain/presets/preset-cookie";
import { parseClinicRoleStaffKind } from "@/lib/clinic-roles";
import { prisma } from "@/lib/prisma";
import { fetchControlPlaneOrganizationName } from "@era/satellite-kit";

export async function GET() {
  try {
    const session = await getSatelliteSession();
    if (!session) return jsonError("Unauthorized", 401);

    const user = await prisma.user.findUnique({
      where: { id: session.sub },
      include: { role: true },
    });
    if (!user) return jsonError("Unauthorized", 401);

    const tenant = await prisma.tenant.findFirst({
      where: { code: "default" },
      select: { name: true, checkInRequiresQr: true, procedureCheckInMode: true },
    });

    const organizationId = session.organizationId;
    const controlPlaneName = await fetchControlPlaneOrganizationName(organizationId);

    const enabledPresets = await getEnabledPresets();

    const mergedSession = {
      ...session,
      email: session.email ?? user.email ?? undefined,
      login: session.login || user.login,
    };

    const bypass = hasClinicPermissionBypass(mergedSession);
    const dbPermissions = session.permissions ?? [];
    const permissions = bypass
      ? [...ALL_CLINIC_PERMISSIONS]
      : resolveSessionPermissions({
          role: user.role.code,
          roles: session.roles,
          permissions: dbPermissions,
        });

    const res = jsonOk({
      id: user.id,
      login: user.login,
      email: user.email,
      fullName: user.fullName,
      role: user.role.code,
      staffKind: parseClinicRoleStaffKind(user.role.staffKind),
      permissions,
      organizationId,
      organizationName: controlPlaneName ?? tenant?.name ?? null,
      canViewClinicAdmin:
        bypass || permissions.some((p) => p.startsWith("screen:admin.")),
      isPlatformSuperAdmin: isPlatformSuperAdminUser(user),
      enabledPresets,
      checkInMode:
        tenant?.procedureCheckInMode ??
        (tenant?.checkInRequiresQr === false ? "MANUAL" : "QR"),
      checkInRequiresQr:
        (tenant?.procedureCheckInMode ??
          (tenant?.checkInRequiresQr === false ? "MANUAL" : "QR")) === "QR",
    });

    res.cookies.set(PRESETS_COOKIE, serializePresetsCookie(enabledPresets), {
      httpOnly: false,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    return res;
  } catch (err) {
    return handleRouteError(err);
  }
}
