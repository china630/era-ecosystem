import { authCookieName, signSatelliteSession } from "@era/satellite-kit";
import { jsonOk } from "@/lib/api-utils";
import { ensureFnbSystemRoles, findUserWithRoleById } from "@/lib/fnb-auth.service";
import { resolveFnbEdition } from "@/lib/auth/ensure-system-fnb-roles";
import { getFnbOrgProfile } from "@/lib/fnb-org-profile";
import { ALL_PERMISSIONS, effectiveRolePermissions, isSystemFnbRoleCode } from "@/lib/auth/permissions";
import { hasFnbPermissionBypass } from "@/lib/auth/permission-check";
import { permissionsForRoleCode } from "@/lib/auth/fnb-permission.service";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

/** Re-sign JWT from current Role.permissionsJson so page middleware matches DB. */

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/auth/session/refresh-permissions", async (httpReq, httpRes) => {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
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

  
    if (!session?.organizationId) return sendJson(httpRes, { error: "Unauthorized" }, 401);

    const organizationId = session.organizationId;
    const profile = await getFnbOrgProfile(organizationId);
    const edition = resolveFnbEdition(profile.edition);
    await ensureFnbSystemRoles(organizationId, edition);

    if (session.pin === true) {
      const code = isSystemFnbRoleCode(session.role)
        ? session.role
        : session.role;
      const permissions = await permissionsForRoleCode(organizationId, code);
      const token = await signSatelliteSession({
        sub: session.sub,
        login: session.login,
        role: code,
        fullName: session.fullName,
        organizationId,
        permissions,
        pin: true,
        outletId: session.outletId,
      });
      const res = jsonOk({ ok: true, permissions });
      res.cookies.set(authCookieName(), token, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 8,
      });
      return sendWebResponse(httpRes, res);
    }

    const user = await findUserWithRoleById(session.sub);
    if (!user || user.status !== "ACTIVE") {
      return sendJson(httpRes, { error: "Unauthorized" }, 401);
    }

    const isOwner =
      session.isOwner === true || user.role.code === "BUSINESS_OWNER";
    const bypass = hasFnbPermissionBypass({
      login: user.login,
      email: user.email ?? undefined,
      role: user.role.code,
      isOwner,
    });
    const permissions = bypass
      ? [...ALL_PERMISSIONS]
      : effectiveRolePermissions(
          user.role.code,
          user.role.permissionsJson,
          edition,
        );

    const token = await signSatelliteSession({
      sub: session.sub,
      login: session.login || user.login,
      email: session.email ?? user.email ?? undefined,
      role: user.role.code,
      fullName: session.fullName || user.fullName,
      organizationId: session.organizationId ?? user.organizationId,
      permissions,
      isOwner,
      financeRole: session.financeRole,
      roles: session.roles,
    });

    const res = jsonOk({ ok: true, permissions });
    res.cookies.set(authCookieName(), token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8,
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
