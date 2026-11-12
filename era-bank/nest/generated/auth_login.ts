import { authCookieName, enterSatelliteTenant, jsonLoginHostBinding, openStaffLogin, satelliteRuntimeConfig, signSatelliteSession, verifySatelliteUserPassword } from "@era/satellite-kit";
import { jsonOk } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { ensureSystemBankRoles } from "@/lib/auth/ensure-system-bank-roles";
import { createOpsSession, findOpsRoleById, findOpsUserForLogin } from "@/lib/bank-ops.service";
import { ALL_PERMISSIONS, effectiveRolePermissions } from "@/lib/auth/permissions";
import { hasBankPermissionBypass } from "@/lib/auth/permission-check";
import { enterBankStaff, bankNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithBankTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";



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

  
    const opened = await openStaffLogin({
      request,
      isShared: satelliteRuntimeConfig().deploymentTopology === "SHARED",
    });
    if (!opened.ok) {
      return sendJson(httpRes, { error: opened.error }, opened.status);
    }
    enterSatelliteTenant({ organizationId: opened.organizationId });

    const username = opened.login.trim();
    const user = await findOpsUserForLogin(opened.organizationId, username);

    if (
      !(await verifySatelliteUserPassword(opened.password, {
        passwordHash: user?.passwordHash ?? "",
        status: user?.status ?? "CLOSED",
      })) ||
      !user
    ) {
      return sendJson(httpRes, { error: "Invalid credentials" }, 401);
    }

    await ensureSystemBankRoles(prisma, user.organizationId);

    const role = await findOpsRoleById(user.opsRoleId);

    const bypass = hasBankPermissionBypass({
      login: user.username,
      role: role.code,
      isOwner: role.code === "BUSINESS_OWNER",
    });
    const permissions = bypass
      ? [...ALL_PERMISSIONS]
      : effectiveRolePermissions(role.code, role.permissionsJson);

    await createOpsSession({ opsUserId: user.id, branchId: user.branchId });

    const token = await signSatelliteSession({
      sub: user.id,
      login: user.username,
      role: role.code,
      fullName: user.fullName,
      organizationId: user.organizationId,
      permissions,
      isOwner: role.code === "BUSINESS_OWNER",
    });

    const res = jsonOk({
      user: {
        id: user.id,
        login: user.username,
        fullName: user.fullName,
        role: role.code,
        branchId: user.branchId,
        organizationId: user.organizationId,
        permissions,
      },
      token,
    });

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
