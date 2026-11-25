/** Lifted from nest/generated/auth_login.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { authCookieName, isSatelliteUserLoginAllowed, describeLoginHostBinding, signSatelliteSession } from "@era/satellite-kit";
import { authenticateFnbStaffLogin, ensureFnbSystemRoles, findUserWithRoleById, touchUserLastLogin } from "@/lib/fnb-auth.service";
import { resolveFnbEdition } from "@/lib/auth/ensure-system-fnb-roles";
import { getFnbOrgProfile } from "@/lib/fnb-org-profile";
import { ALL_PERMISSIONS, effectiveRolePermissions } from "@/lib/auth/permissions";
import { hasFnbPermissionBypass } from "@/lib/auth/permission-check";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, cookieSeconds, sendRouteError } from "../../bridge";




@Controller()
export class AuthLoginController {
  @Post("api/auth/login")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const web = await (async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {
      

  
    const auth = await authenticateFnbStaffLogin({ headers: { get: (name) => nestHeader(httpReq, name) }, body: httpReq.body });
    if (!auth.ok) {
      return sendJson(httpRes, { error: auth.error }, auth.status);
    }
    const user = auth.user;
    const organizationId = auth.organizationId;

    const profile = await getFnbOrgProfile(organizationId);
    const edition = resolveFnbEdition(profile.edition);
    await ensureFnbSystemRoles(organizationId, edition);

    const refreshed = await findUserWithRoleById(user.id);
    if (!refreshed || !isSatelliteUserLoginAllowed(refreshed)) {
      return sendJson(httpRes, { error: "Invalid credentials" }, 401);
    }

    await touchUserLastLogin(refreshed.id);

    const bypass = hasFnbPermissionBypass({
      login: refreshed.login,
      email: refreshed.email ?? undefined,
      role: refreshed.role.code,
      isOwner: false,
    });
    const permissions = bypass
      ? [...ALL_PERMISSIONS]
      : effectiveRolePermissions(
          refreshed.role.code,
          refreshed.role.permissionsJson,
          edition,
        );

    const token = await signSatelliteSession({
      sub: refreshed.id,
      login: refreshed.login,
      email: refreshed.email ?? undefined,
      role: refreshed.role.code,
      fullName: refreshed.fullName,
      organizationId,
      permissions,
    });
    cookieSeconds(httpRes, authCookieName(), token, 60 * 60 * 8);
    return sendJson(httpRes, {
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
  
        });
      })();
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }

  @Get("api/auth/login")
  @HttpCode(200)
  async get_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const web = await (async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {
      

  return sendJson(httpRes, describeLoginHostBinding({ get: (name) => nestHeader(httpReq, name) }));

        });
      })();
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
