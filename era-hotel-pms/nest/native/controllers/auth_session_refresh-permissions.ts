/** Lifted from era-hotel-pms/nest/generated/auth_session_refresh-permissions.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { signSatelliteSession } from "@era/satellite-kit";
import { remapPermissionList } from "@/lib/auth/hotel-permission-rename";
import { loadUserWithRole } from "@/lib/services/hotel-auth.service";
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, cookieSeconds, sendRouteError } from "../../bridge";

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? "era_session";

/** Re-sign JWT from current Role.permissionsJson so page middleware matches DB. */


@Controller()
export class AuthSessionRefreshPermissionsController {
  @Post("api/auth/session/refresh-permissions")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
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

    cookieSeconds(httpRes, COOKIE_NAME, token, 60 * 60 * 8);
    return sendJson(httpRes, { ok: true, permissions });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
