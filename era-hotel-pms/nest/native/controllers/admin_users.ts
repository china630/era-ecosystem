/** Lifted from era-hotel-pms/nest/generated/admin_users.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { createUser, listUsers } from '@/lib/services/user.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const createSchema = z.object({
  login: z.string().min(2),
  fullName: z.string().min(1),
  password: z.string().min(6),
  roleId: z.string().uuid(),
  email: z.string().email().optional(),
  department: z.string().optional(),
});


@Controller()
export class AdminUsersController {
  @Get("api/admin/users")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.USERS_MANAGE);
    const users = await listUsers();
    return sendJson(httpRes, 
      serialize(
        users.map((u) => ({
          id: u.id,
          login: u.login,
          fullName: u.fullName,
          email: u.email,
          department: u.department,
          status: u.status,
          isCrossSystem: u.isCrossSystem,
          cpEmploymentId: u.cpEmploymentId,
          positionTitle: u.positionTitle,
          role: u.role.code,
          roleName: u.role.name,
          lastLoginAt: u.lastLoginAt,
        })),
      ),
    );
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Post("api/admin/users")
  @HttpCode(200)
  async post_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  try {
    assertPermission(session, PERMISSIONS.USERS_MANAGE);
    const body = createSchema.parse(httpReq.body);
    const user = await createUser(body);
    return sendJson(httpRes, serialize(user), 201);
  } catch (err) {
    if (err instanceof Error && (err as Error & { code?: string }).code === 'QUOTA_EXCEEDED') {
      return sendJson(httpRes, { error: err.message }, 403);
    }
    if (err instanceof Error && err.message.includes('Forbidden')) {
      return sendJson(httpRes, { error: err.message }, 403);
    }
    return sendRouteError(httpRes, err);
  }

      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
