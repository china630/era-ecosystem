/** Lifted from nest/generated/auth_session_refresh-permissions.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { authCookieName, signSatelliteSession } from "@era/satellite-kit";
import { prisma } from "@/lib/prisma";
import { ensureSystemRoles } from "@/lib/auth/ensure-system-retail-roles";
import { OWNER_ROLE_CODE } from "@/lib/auth/permission-check";
import { enterRetailStaff, retailNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithRetailTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, cookieSeconds, sendRouteError } from "../../bridge";

/** Re-sign the JWT from the current role row so page middleware matches the DB. */


@Controller()
export class AuthSessionRefreshPermissionsController {
  @Post("api/auth/session/refresh-permissions")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterRetailStaff(httpReq, httpRes))) return;
    try {
      const session = await retailNestSession(httpReq);
      const web = await runWithRetailTenant(session, async () => {

  
    const fresh = session;
    if (!fresh) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    await ensureSystemRoles(prisma, fresh.organizationId);

    const token = await signSatelliteSession({
      sub: fresh.sub,
      login: fresh.login,
      email: fresh.email,
      role: fresh.role,
      roles: fresh.roles,
      fullName: fresh.fullName,
      organizationId: fresh.organizationId,
      isOwner: fresh.isOwner === true || fresh.role === OWNER_ROLE_CODE,
      financeRole: fresh.financeRole,
      permissions: fresh.permissions,
    });
    cookieSeconds(httpRes, authCookieName(), token, 60 * 60 * 8);
    return sendJson(httpRes, { ok: true, permissions: fresh.permissions });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
