/** Lifted from era-hotel-pms/nest/generated/admin_ops-wipe.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { getSatelliteSession } from '@/lib/auth/session';
import { isPlatformSuperAdminUser } from '@/lib/auth/platform-super-admin';
import { recordHotelAudit } from '@/lib/satellite-audit';
import { countOpsWipe, runOpsWipe } from '@/lib/services/ops-wipe.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const confirmSchema = z.object({
  organizationId: z.string().uuid(),
  confirmPhrase: z.literal('WIPE'),
  ops: z.array(z.string()).optional(),
});

async function superAdminSession() {
  const session = await getSatelliteSession();
  if (!session) throw Object.assign(new Error('Unauthorized'), { status: 401 });
  if (!isPlatformSuperAdminUser({ email: session.email ?? null, login: session.login })) {
    throw Object.assign(new Error('Forbidden: platform super admin only'), { status: 403 });
  }
  return session;
}


@Controller()
export class AdminOpsWipeController {
  @Get("api/admin/ops-wipe")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const web = await (async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {

  
    const session = await superAdminSession();
    return sendJson(httpRes, {
      organizationId: session.organizationId,
      counts: await countOpsWipe(session.organizationId),
    });
  
        });
      })();
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Post("api/admin/ops-wipe")
  @HttpCode(200)
  async post_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const web = await (async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {

  
    const session = await superAdminSession();
    const body = confirmSchema.parse(httpReq.body);
    if (body.organizationId !== session.organizationId) {
      throw Object.assign(new Error('Organization changed since counts were loaded — reload the page'), {
        status: 409,
      });
    }
    const deleted = await runOpsWipe(
      session.organizationId,
      body.ops ? { ops: body.ops } : undefined,
    );
    await recordHotelAudit({ userId: session.sub, request: { headers: { get: (name: string) => nestHeader(httpReq, name) } } }, 'OpsWipe', session.organizationId, 'WIPE', {
      deleted,
    });
    return sendJson(httpRes, {
      organizationId: session.organizationId,
      deleted,
      counts: await countOpsWipe(session.organizationId),
    });
  
        });
      })();
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
