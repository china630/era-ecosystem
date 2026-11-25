/** Lifted from era-hotel-pms/nest/generated/admin_users__id.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { updateUser } from '@/lib/services/user.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const patchSchema = z.object({
  fullName: z.string().min(1).optional(),
  password: z.string().min(6).optional(),
  roleId: z.string().uuid().optional(),
  email: z.string().email().nullable().optional(),
  department: z.string().nullable().optional(),
  status: z.enum(['ACTIVE', 'DISABLED']).optional(),
});


@Controller()
export class AdminUsersIdController {
  @Patch("api/admin/users/:id")
  @HttpCode(200)
  async patch_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.USERS_MANAGE);
    const { id } = httpReq.params;
    const body = patchSchema.parse(httpReq.body);
    const user = await updateUser(id, body);
    return sendJson(httpRes, 
      serialize({
        id: user.id,
        login: user.login,
        fullName: user.fullName,
        email: user.email,
        department: user.department,
        status: user.status,
        role: user.role.code,
      }),
    );
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
