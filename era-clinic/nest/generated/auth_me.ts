import { jsonOk } from "@/lib/api-utils";
import { hasClinicPermissionBypass } from "@/lib/auth/clinic-admin-access";
import { resolveSessionPermissions } from "@/lib/auth/clinic-permission.service";
import { ALL_CLINIC_PERMISSIONS } from "@/lib/auth/clinic-permissions";
import { isPlatformSuperAdminUser } from "@/lib/auth/platform-super-admin";
import { getEnabledPresets } from "@/domain/settings/settings.service";
import { PRESETS_COOKIE, serializePresetsCookie } from "@/domain/presets/preset-cookie";
import { parseClinicRoleStaffKind } from "@/lib/clinic-roles";
import { findDefaultTenantCheckInSettings, findSessionUserWithRole } from "@/domain/auth/auth-me.service";
import { fetchControlPlaneOrganizationName } from "@era/satellite-kit";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";



export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/auth/me", async (httpReq, httpRes) => {
    if (!(await enterClinicStaff(httpReq, httpRes))) return;
    try {
      const session = await clinicNestSession(httpReq);
      const web = await runWithClinicTenant(session, async () => {
        return runWithNestHttp(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const request = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    if (!session) return sendJson(httpRes, { error: "Unauthorized" }, 401);

    const user = await findSessionUserWithRole(session.sub);
    if (!user) return sendJson(httpRes, { error: "Unauthorized" }, 401);

    const tenant = await findDefaultTenantCheckInSettings();

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

    return sendWebResponse(httpRes, res);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
