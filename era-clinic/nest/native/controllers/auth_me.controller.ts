import { Controller, Get, HttpCode, Req, Res, UseGuards } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request, Response } from "express";
import {
  sendJson,
  withClinicStaff,
} from "../../bridge";
import { jsonOk } from "@/lib/api-utils";
import { hasClinicPermissionBypass } from "@/lib/auth/clinic-admin-access";
import { resolveSessionPermissions } from "@/lib/auth/clinic-permission.service";
import { ALL_CLINIC_PERMISSIONS } from "@/lib/auth/clinic-permissions";
import { isPlatformSuperAdminUser } from "@/lib/auth/platform-super-admin";
import { getEnabledPresets } from "@/domain/settings/settings.service";
import { PRESETS_COOKIE, serializePresetsCookie } from "@/domain/presets/preset-cookie";
import { parseClinicRoleStaffKind } from "@/lib/clinic-roles";
import { findDefaultTenantCheckInSettings, findSessionUserWithRole } from "@/domain/auth/auth-me.service";
import { fetchControlPlaneOrganizationName } from "@era/satellite-kit";

@Controller()
export class AuthMeController {

  @UseGuards(ClinicApiGuard)
  @Get("api/auth/me")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
    @Res({ passthrough: false }) httpRes: Response,
  ) {
    const session = readClinicSession(httpReq);
    await withClinicStaff(httpReq, session, async () => {


  
    if (!session) { sendJson(httpRes, { error: "Unauthorized" }, 401); return; }

    const user = await findSessionUserWithRole(session.sub);
    if (!user) { sendJson(httpRes, { error: "Unauthorized" }, 401); return; }

    const tenant = await findDefaultTenantCheckInSettings();

    const organizationId = session.organizationId;
    const controlPlaneName = await fetchControlPlaneOrganizationName(organizationId);

    const enabledPresets = await getEnabledPresets();

    const mergedSession = {
      ...session,
      email: session.email ?? user.email ?? undefined,
      login: session.login || user.login,
    };

    const bypass = hasClinicPermissionBypass(mergedSession);
    const dbPermissions = session.permissions ?? [];
    const permissions = bypass
      ? [...ALL_CLINIC_PERMISSIONS]
      : resolveSessionPermissions({
          role: user.role.code,
          roles: session.roles,
          permissions: dbPermissions,
        });

    const res = jsonOk({
      id: user.id,
      login: user.login,
      email: user.email,
      fullName: user.fullName,
      role: user.role.code,
      staffKind: parseClinicRoleStaffKind(user.role.staffKind),
      permissions,
      organizationId,
      organizationName: controlPlaneName ?? tenant?.name ?? null,
      canViewClinicAdmin:
        bypass || permissions.some((p) => p.startsWith("screen:admin.")),
      isPlatformSuperAdmin: isPlatformSuperAdminUser(user),
      enabledPresets,
      checkInMode:
        tenant?.procedureCheckInMode ??
        (tenant?.checkInRequiresQr === false ? "MANUAL" : "QR"),
      checkInRequiresQr:
        (tenant?.procedureCheckInMode ??
          (tenant?.checkInRequiresQr === false ? "MANUAL" : "QR")) === "QR",
    });

    httpRes.cookie(PRESETS_COOKIE, serializePresetsCookie(enabledPresets), {
      httpOnly: false,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30 * 1000,
    });

    sendJson(httpRes, res.body, res.status); return;
  
        });
  }
}
