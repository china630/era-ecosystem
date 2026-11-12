import { jsonOk } from "@/lib/api-utils";
import { signSatelliteSession } from "@era/satellite-kit";
import { remapPermissionList } from "@/lib/auth/hotel-permission-rename";
import { loadUserWithRole } from "@/lib/services/hotel-auth.service";
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? "era_session";

/** Re-sign JWT from current Role.permissionsJson so page middleware matches DB. */

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/auth/session/refresh-permissions", async (httpReq, httpRes) => {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {
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

    const user = await loadUserWithRole(session.sub);
    if (!user) return sendJson(httpRes, { error: "Unauthorized" }, 401);

    const isOwner =
      session.isOwner === true || user.role.code === "BUSINESS_OWNER";
    const permissions = session.permissions ?? [];
    const token = await signSatelliteSession({
      sub: session.sub,
      login: session.login || user.login,
      role: user.role.code,
      fullName: session.fullName || user.fullName,
      email: session.email ?? user.email ?? undefined,
      organizationId: session.organizationId,
      permissions: permissions.length ? remapPermissionList(permissions) : undefined,
      isOwner: isOwner || undefined,
    });

    const res = jsonOk({ ok: true, permissions });
    res.cookies.set(COOKIE_NAME, token, {
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
