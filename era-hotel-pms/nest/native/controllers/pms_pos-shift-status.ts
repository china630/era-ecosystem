/** Lifted from era-hotel-pms/nest/generated/pms_pos-shift-status.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { getPosShiftStatus, reportPosShiftStatus } from '@/lib/services/pms-bridge.service';
import { assertPosBridgeOrPermission } from '@/lib/pos-bridge-auth';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterRequestTenant } from '@/lib/request-organization';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const putSchema = z.object({
  outletCode: z.string().min(1),
  shiftId: z.string().min(1),
  status: z.enum(['OPEN', 'CLOSED']),
  propertyCode: z.string().optional(),
  openedAt: z.string().optional(),
  closedAt: z.string().optional(),
});


@Controller()
export class PmsPosShiftStatusController {
  @Get("api/pms/pos-shift-status")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const web = await (async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {

  
    await assertPosBridgeOrPermission({ headers: { get: (name: string) => nestHeader(httpReq, name) }, url: new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1").toString() }, PERMISSIONS.NIGHT_AUDIT_RUN);
    return sendJson(httpRes, serialize(await getPosShiftStatus()));
  
        });
      })();
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Put("api/pms/pos-shift-status")
  @HttpCode(200)
  async put_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const web = await (async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {

  
    await assertPosBridgeOrPermission({ headers: { get: (name: string) => nestHeader(httpReq, name) }, url: new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1").toString() }, PERMISSIONS.NIGHT_AUDIT_RUN);
    const organizationId = nestHeader(httpReq, 'x-era-organization-id')?.trim() ?? '';
    if (!organizationId || organizationId === 'demo-org') {
      return sendJson(httpRes, { error: 'organizationId required' }, 400);
    }
    enterRequestTenant(organizationId);
    const body = putSchema.parse(httpReq.body);
    await reportPosShiftStatus({
      outletCode: body.outletCode,
      shiftId: body.shiftId,
      status: body.status,
      propertyCode: body.propertyCode,
      openedAt: body.openedAt,
      closedAt: body.closedAt,
    });
    return new Response(null, { status: 204 });
  
        });
      })();
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
