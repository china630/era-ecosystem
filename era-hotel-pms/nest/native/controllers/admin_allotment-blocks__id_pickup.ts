/** Lifted from era-hotel-pms/nest/generated/admin_allotment-blocks__id_pickup.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { pickupAllotmentBlock } from '@/lib/services/allotment-block-pickup.service';
import { assertMasterDataWrite } from '@/lib/auth/master-data-guard';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { requireHotelModule } from '@/lib/hotel-module-gate';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const schema = z.object({
  bookingCode: z.string().min(1).max(32),
  bookingName: z.string().optional(),
  guestId: z.string().uuid(),
  folioMode: z.enum(['INDIVIDUAL', 'MASTER', 'SPLIT']).optional(),
  paymentMethod: z.enum(['CASH', 'CARD', 'COMPANY_ACCOUNT', 'LOYALTY_POINTS']).optional(),
  quantities: z.record(z.string().uuid(), z.number().int().nonnegative()).optional(),
});

type Ctx = { params: Promise<{ id: string }> };


@Controller()
export class AdminAllotmentBlocksIdPickupController {
  @Post("api/admin/allotment-blocks/:id/pickup")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertMasterDataWrite(session, PERMISSIONS.ALLOTMENT_ADMIN);
    await requireHotelModule('hotel_distribution', session.organizationId);
    const { id } = httpReq.params;
    const body = schema.parse(httpReq.body);
    const result = await pickupAllotmentBlock({
      allotmentBlockId: id,
      ...body,
      audit: { userId: session?.sub, request: { headers: { get: (name: string) => nestHeader(httpReq, name) } } },
    });
    return sendJson(httpRes, serialize(result), 201);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
