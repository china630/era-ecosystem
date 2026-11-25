/** Lifted from nest/generated/auth_login.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { authCookieName, authenticateIndustryStaffLogin, describeLoginHostBinding, jsonLoginHostBinding, satelliteRuntimeConfig, signSatelliteSession } from "@era/satellite-kit";
import { prisma } from "@/lib/prisma";
import { ensureSystemRoles } from "@/lib/auth/ensure-system-retail-roles";
import { OWNER_ROLE_CODE } from "@/lib/auth/permission-check";
import { grantsForUser } from "@/lib/auth/retail-permission.service";
import { getUserWithRoleById, recordStaffLogin } from "@/lib/retail-auth.service";
import { enterRetailStaff, retailNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithRetailTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, cookieSeconds, sendRouteError } from "../../bridge";




@Controller()
export class AuthLoginController {
  @Post("api/auth/login")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const web = await (async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {

  
    const auth = await authenticateIndustryStaffLogin({
      headers: { get: (name: string) => nestHeader(httpReq, name) },
      body: httpReq.body,
      prisma,
      isShared: satelliteRuntimeConfig().deploymentTopology === "SHARED",
    });
    if (!auth.ok) {
      return sendJson(httpRes, { error: auth.error }, auth.status);
    }
    const found = auth.user;
    const organizationId = auth.organizationId;
    await ensureSystemRoles(prisma, organizationId);

    const user = await getUserWithRoleById(found.id);
    if (!user) return sendJson(httpRes, { error: "Invalid credentials" }, 401);
    const isOwner = user.role.code === OWNER_ROLE_CODE;
    const permissions = grantsForUser({
      login: user.login,
      email: user.email,
      role: user.role,
      isOwner,
    });

    const token = await signSatelliteSession({
      sub: user.id,
      login: user.login,
      email: user.email ?? undefined,
      role: user.role.code,
      fullName: user.fullName,
      organizationId,
      isOwner,
      permissions,
    });
    await recordStaffLogin({
      organizationId,
      userId: user.id,
      login: user.login,
      ipAddress: nestHeader(httpReq, "x-forwarded-for")?.split(",")[0]?.trim() || null,
      userAgent: nestHeader(httpReq, "user-agent"),
    });

    cookieSeconds(httpRes, authCookieName(), token, 60 * 60 * 8);
    return sendJson(httpRes, {
      user: {
        id: user.id,
        login: user.login,
        fullName: user.fullName,
        role: user.role.code,
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
