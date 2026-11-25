import { Controller, Get, HttpCode, Post, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import {
  sendJson,
  withClinicHttp,
} from "../../bridge";
import { authCookieName, authenticateIndustryStaffLogin, describeLoginHostBinding, expressKitHeaders, runWithSatelliteTenant, satelliteRuntimeConfig, signSatelliteSession } from "@era/satellite-kit";
import { jsonOk } from "@/lib/api-utils";
import { permissionsForUser } from "@/lib/auth/clinic-permission.service";
import { getEnabledPresets } from "@/domain/settings/settings.service";
import { PRESETS_COOKIE, serializePresetsCookie } from "@/domain/presets/preset-cookie";
import { prisma } from "@/lib/prisma";
import { recordUserLogin } from "@/domain/auth/user-login.service";

@Controller()
export class AuthLoginController {

  @Post("api/auth/login")
  @HttpCode(200)
  async post_0(
    @Req() httpReq: Request,
    @Res({ passthrough: false }) httpRes: Response,
  ) {
    await withClinicHttp(httpReq, async () => {
    const headers = expressKitHeaders(httpReq);
    const auth = await authenticateIndustryStaffLogin({
      headers,
      body: httpReq.body,
      prisma,
      isShared: satelliteRuntimeConfig().deploymentTopology === "SHARED",
    });
    if (!auth.ok) {
      sendJson(httpRes, { error: auth.error }, auth.status); return;
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
      headers,
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
    httpRes.cookie(authCookieName(), token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8 * 1000,
    });
    httpRes.cookie(PRESETS_COOKIE, serializePresetsCookie(enabledPresets), {
      httpOnly: false,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30 * 1000,
    });
    sendJson(httpRes, res.body, res.status); return;
    });
  
        });
  }

  @Get("api/auth/login")
  @HttpCode(200)
  async get_1(
    @Req() httpReq: Request,
    @Res({ passthrough: false }) httpRes: Response,
  ) {
    await withClinicHttp(httpReq, async () => {
    sendJson(httpRes, describeLoginHostBinding(expressKitHeaders(httpReq)), 200); return;

        });
  }
}
