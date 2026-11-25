/** Lifted from nest/generated/auth_session_refresh-permissions.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { authCookieName, signSatelliteSession } from "@era/satellite-kit";
import { ensureFnbSystemRoles, findUserWithRoleById } from "@/lib/fnb-auth.service";
import { resolveFnbEdition } from "@/lib/auth/ensure-system-fnb-roles";
import { getFnbOrgProfile } from "@/lib/fnb-org-profile";
import { ALL_PERMISSIONS, effectiveRolePermissions, isSystemFnbRoleCode } from "@/lib/auth/permissions";
import { hasFnbPermissionBypass } from "@/lib/auth/permission-check";
import { permissionsForRoleCode } from "@/lib/auth/fnb-permission.service";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, cookieSeconds, sendRouteError } from "../../bridge";

/** Re-sign JWT from current Role.permissionsJson so page middleware matches DB. */


@Controller()
export class AuthSessionRefreshPermissionsController {
  @Post("api/auth/session/refresh-permissions")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  
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
      cookieSeconds(httpRes, authCookieName(), token, 60 * 60 * 8);
      return sendJson(httpRes, { ok: true, permissions });
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

    cookieSeconds(httpRes, authCookieName(), token, 60 * 60 * 8);
    return sendJson(httpRes, { ok: true, permissions });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
