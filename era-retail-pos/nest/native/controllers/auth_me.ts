/** Lifted from nest/generated/auth_me.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { isPlatformSuperAdminEdge } from "@/lib/auth/platform-super-admin-edge";
import { OWNER_ROLE_CODE } from "@/lib/auth/permission-check";
import { getUserProfileById } from "@/lib/retail-auth.service";
import { enterRetailStaff, retailNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithRetailTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

/** Signed-in person and current DB grants for the ops shell and client doors. */


@Controller()
export class AuthMeController {
  @Get("api/auth/me")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterRetailStaff(httpReq, httpRes))) return;
    try {
      const session = await retailNestSession(httpReq);
      const web = await runWithRetailTenant(session, async () => {

  
    if (!session) return sendJson(httpRes, { error: "Unauthorized" }, 401);

    const user = await getUserProfileById(session.sub);
    if (!user) return sendJson(httpRes, { error: "User not found" }, 404);

    return sendJson(httpRes, {
      id: user.id,
      login: user.login,
      email: user.email,
      fullName: user.fullName,
      role: session.role,
      organizationId: session.organizationId,
      organizationName: null,
      permissions: session.permissions,
      isOwner: session.isOwner === true || session.role === OWNER_ROLE_CODE,
      isPlatformSuperAdmin: isPlatformSuperAdminEdge(user),
    });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
