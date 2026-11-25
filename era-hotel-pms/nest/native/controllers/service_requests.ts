/** Lifted from era-hotel-pms/nest/generated/service_requests.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { requireHotelModule } from '@/lib/hotel-module-gate';
import { createServiceRequest, listServiceRequests } from '@/lib/services/service-work-order.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const createSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  category: z.string().optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH']).optional(),
  source: z.enum(['GUEST', 'STAFF', 'RECURRING']).optional(),
  roomId: z.string().uuid().optional(),
  location: z.string().optional(),
  reportedBy: z.string().optional(),
});


@Controller()
export class ServiceRequestsController {
  @Get("api/service/requests")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    if (!session) return sendJson(httpRes, { error: 'Unauthorized' }, 401);
    await requireHotelModule('hotel_service', session.organizationId);
    const url = requestUrl;
    const status = url.searchParams.get('status') ?? undefined;
    const rows = await listServiceRequests(status);
    return sendJson(httpRes, rows);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Post("api/service/requests")
  @HttpCode(200)
  async post_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    if (!session) return sendJson(httpRes, { error: 'Unauthorized' }, 401);
    await requireHotelModule('hotel_service', session.organizationId);
    const body = createSchema.parse(httpReq.body);
    const row = await createServiceRequest(body);
    return sendJson(httpRes, row, 201);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
