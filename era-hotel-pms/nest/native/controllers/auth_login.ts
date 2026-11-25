/** Lifted from era-hotel-pms/nest/generated/auth_login.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { jsonLoginHostBinding, signSatelliteSession } from "@era/satellite-kit";
import { remapPermissionList } from "@/lib/auth/hotel-permission-rename";
import { recordUserLogin, userPermissions } from "@/lib/services/user.service";
import { authenticateStaffLogin, completeStaffLoginAfterAuth } from "@/lib/services/hotel-auth.service";
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, cookieSeconds, sendRouteError } from "../../bridge";

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? "era_session";


@Controller()
export class AuthLoginController {
  @Post("api/auth/login")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const web = await (async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {

  
    const auth = await authenticateStaffLogin({
      headers: { get: (name: string) => nestHeader(httpReq, name) },
      body: httpReq.body,
    });
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
      { headers: { get: (name: string) => nestHeader(httpReq, name) } },
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

    cookieSeconds(httpRes, COOKIE_NAME, token, 60 * 60 * 8);
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

  return sendJson(httpRes, describeLoginHostBinding({ get: (name: string) => nestHeader(httpReq, name) }));

        });
      })();
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
