import { Controller, HttpCode, Post, Req, Res, UseGuards } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request, Response } from "express";
import {
  sendJson,
  withClinicStaff,
} from "../../bridge";
import { authCookieName, signSatelliteSession } from "@era/satellite-kit";
import { jsonOk } from "@/lib/api-utils";


/** Re-sign JWT from current Role.permissionsJson so page middleware matches DB. */

@Controller()
export class AuthSessionRefreshPermissionsController {

  @UseGuards(ClinicApiGuard)
  @Post("api/auth/session/refresh-permissions")
  @HttpCode(200)
  async post_0(
    @Req() httpReq: Request,
    @Res({ passthrough: false }) httpRes: Response,
  ) {
    const session = readClinicSession(httpReq);
    await withClinicStaff(httpReq, session, async () => {


  
    if (!session) { sendJson(httpRes, { error: "Unauthorized" }, 401); return; }

    const permissions = session.permissions ?? [];
    const token = await signSatelliteSession({
      sub: session.sub,
      login: session.login,
      email: session.email,
      role: session.role,
      fullName: session.fullName,
      organizationId: session.organizationId,
      roles: session.roles,
      isOwner: session.isOwner,
      financeRole: session.financeRole,
      permissions,
    });

    const res = jsonOk({ ok: true, permissions });
    httpRes.cookie(authCookieName(), token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8 * 1000,
    });
    sendJson(httpRes, res.body, res.status); return;
  
        });
  }
}
