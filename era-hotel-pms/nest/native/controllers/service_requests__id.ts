/** Lifted from era-hotel-pms/nest/generated/service_requests__id.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { requireHotelModule } from '@/lib/hotel-module-gate';
import { updateServiceRequestStatus } from '@/lib/services/service-work-order.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const patchSchema = z.object({
  status: z.enum(['IN_PROGRESS', 'DONE', 'CANCELLED']),
});


@Controller()
export class ServiceRequestsIdController {
  @Patch("api/service/requests/:id")
  @HttpCode(200)
  async patch_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    if (!session) return sendJson(httpRes, { error: 'Unauthorized' }, 401);
    await requireHotelModule('hotel_service', session.organizationId);
    const { id } = httpReq.params;
    const body = patchSchema.parse(httpReq.body);
    const row = await updateServiceRequestStatus(id, body.status);
    return sendJson(httpRes, row);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
