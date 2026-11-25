/** Lifted from nest/generated/admin_user-logins.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { assertPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { listUserLogins } from "@/lib/retail-user-admin.service";
import { enterRetailStaff, retailNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithRetailTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class AdminUserLoginsController {
  @Get("api/admin/user-logins")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterRetailStaff(httpReq, httpRes))) return;
    try {
      const session = await retailNestSession(httpReq);
      const web = await runWithRetailTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.ACCESS_MANAGE);
    const url = requestUrl;
    const q = url.searchParams.get("q")?.trim() ?? "";
    const from = url.searchParams.get("from")?.trim() ?? "";
    const to = url.searchParams.get("to")?.trim() ?? "";
    const rows = await listUserLogins({
      organizationId: session.organizationId,
      q,
      from,
      to,
    });
    return sendJson(httpRes, 
      rows.map((row) => ({
        id: row.id,
        login: row.login || row.user.login,
        fullName: row.user.fullName,
        ipAddress: row.ipAddress,
        userAgent: row.userAgent,
        createdAt: row.createdAt.toISOString(),
      })),
    );
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
