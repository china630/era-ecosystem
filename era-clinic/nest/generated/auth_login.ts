import { authCookieName, authenticateIndustryStaffLogin, jsonLoginHostBinding, runWithSatelliteTenant, satelliteRuntimeConfig, signSatelliteSession } from "@era/satellite-kit";
import { jsonOk } from "@/lib/api-utils";
import { permissionsForUser } from "@/lib/auth/clinic-permission.service";
import { getEnabledPresets } from "@/domain/settings/settings.service";
import { PRESETS_COOKIE, serializePresetsCookie } from "@/domain/presets/preset-cookie";
import { prisma } from "@/lib/prisma";
import { recordUserLogin } from "@/domain/auth/user-login.service";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";



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

  
    const auth = await authenticateIndustryStaffLogin({
      request,
      prisma,
      isShared: satelliteRuntimeConfig().deploymentTopology === "SHARED",
    });
    if (!auth.ok) {
      return sendJson(httpRes, { error: auth.error }, auth.status);
    }
    const user = auth.user;
    const organizationId = auth.organizationId;

    return runWithSatelliteTenant({ organizationId }, async () => {
    const { ensureSystemClinicRoles } = await import(
      "@/lib/auth/ensure-system-clinic-roles"
    );
    await ensureSystemClinicRoles(prisma, organizationId);
    const { ensureClinicCatalogIfEmpty } = await import(
      "@/domain/catalog/ensure-clinic-catalog-from-templates"
    );
    await ensureClinicCatalogIfEmpty(prisma, organizationId);

    const permissions = await permissionsForUser(user.id);
    await recordUserLogin(
      { id: user.id, organizationId, login: user.login },
      request,
    );
    const token = await signSatelliteSession({
      sub: user.id,
      login: user.login,
      email: user.email ?? undefined,
      role: user.role.code,
      fullName: user.fullName,
      organizationId,
      permissions,
    });
    const enabledPresets = await getEnabledPresets();
    const res = jsonOk({
      user: {
        id: user.id,
        login: user.login,
        fullName: user.fullName,
        role: user.role.code,
        organizationId,
      },
      token,
      enabledPresets,
    });
    res.cookies.set(authCookieName(), token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8,
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
