import { jsonLoginHostBinding, signSatelliteSession } from "@era/satellite-kit";
import { jsonOk } from "@/lib/api-utils";
import { remapPermissionList } from "@/lib/auth/hotel-permission-rename";
import { recordUserLogin, userPermissions } from "@/lib/services/user.service";
import { authenticateStaffLogin, completeStaffLoginAfterAuth } from "@/lib/services/hotel-auth.service";
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? "era_session";

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/auth/login", async (httpReq, httpRes) => {
    try {
      const web = await runWithNestHttp(httpReq, async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const request = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    const auth = await authenticateStaffLogin(request);
    if (!auth.ok) {
      return sendJson(httpRes, { error: auth.error }, ( { status: auth.status }).status ?? 200);
    }
    const organizationId = auth.organizationId;

    const refreshed = await completeStaffLoginAfterAuth(auth.user.id, organizationId);
    if (!refreshed || refreshed.status !== "ACTIVE") {
      return sendJson(httpRes, { error: "Invalid credentials" }, 401);
    }
    await recordUserLogin(
      { id: refreshed.id, organizationId, login: refreshed.login },
      request,
    );

    const permissions = userPermissions(refreshed);
    const token = await signSatelliteSession({
      sub: refreshed.id,
      login: refreshed.login,
      role: refreshed.role.code,
      fullName: refreshed.fullName,
      email: refreshed.email ?? undefined,
      organizationId,
      permissions: permissions.length ? remapPermissionList(permissions) : undefined,
    });

    const res = jsonOk({
      user: {
        id: refreshed.id,
        login: refreshed.login,
        fullName: refreshed.fullName,
        role: refreshed.role.code,
        organizationId,
        permissions,
      },
      token,
    });

    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      // Next cookies().set maxAge is seconds. Matches kit SATELLITE_SESSION_COOKIE_MAX_AGE_MS (4h).
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
  http.get("/api/auth/login", async (httpReq, httpRes) => {
    try {
      const web = await runWithNestHttp(httpReq, async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const request = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  return sendWebResponse(httpRes, jsonLoginHostBinding(request));

        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
