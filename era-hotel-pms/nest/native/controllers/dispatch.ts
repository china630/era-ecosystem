/** Lifted from era-hotel-pms/nest/generated/dispatch.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { listDispatchRequests, listDispatchVehicles, createDispatchRequest, assignDispatchRequest, completeDispatchRequest } from '@/lib/services/dispatch.service';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const createSchema = z.object({
  guestId: z.string().uuid().optional(),
  fromLabel: z.string().min(1),
  toLabel: z.string().min(1),
  notes: z.string().optional(),
});


@Controller()
export class DispatchController {
  @Get("api/dispatch")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.DISPATCH_READ);
    const [requests, vehicles] = await Promise.all([
      listDispatchRequests(),
      listDispatchVehicles(),
    ]);
    return sendJson(httpRes, serialize({ requests, vehicles }));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Post("api/dispatch")
  @HttpCode(200)
  async post_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.DISPATCH_WRITE);
    const body = httpReq.body;
    if (body.action === 'assign') {
      return sendJson(httpRes, serialize(await assignDispatchRequest(body.id, body.vehicleId)));
    }
    if (body.action === 'complete') {
      return sendJson(httpRes, serialize(await completeDispatchRequest(body.id)));
    }
    return sendJson(httpRes, serialize(await createDispatchRequest(createSchema.parse(body))), 201);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
