/** Lifted from era-hotel-pms/nest/generated/transfers__id.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { assignVehicle, cancelTransfer, completeTransfer } from '@/lib/services/transfer.service';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const patchSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('assign'),
    vehicleId: z.string().uuid(),
  }),
  z.object({
    action: z.literal('complete'),
  }),
  z.object({
    action: z.literal('cancel'),
    reason: z.string().max(200).optional(),
  }),
]);


@Controller()
export class TransfersIdController {
  @Patch("api/transfers/:id")
  @HttpCode(200)
  async patch_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.TRANSFERS_WRITE);
    const { id } = httpReq.params;
    const body = patchSchema.parse(httpReq.body);

    const result =
      body.action === 'assign'
        ? await assignVehicle(id, body.vehicleId)
        : body.action === 'complete'
          ? await completeTransfer(id)
          : await cancelTransfer(id, body.reason);

    return sendJson(httpRes, serialize(result));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
