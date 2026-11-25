/** Lifted from era-hotel-pms/nest/generated/service_guest-request.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { createServiceRequest, findRoomIdByNumber } from '@/lib/services/service-work-order.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const bodySchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  roomNumber: z.string().max(16).optional(),
  token: z.string().optional(),
});

/** Public guest service request (QR in room). Optional SERVICE_GUEST_TOKEN env. */


@Controller()
export class ServiceGuestRequestController {
  @Post("api/service/guest-request")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const web = await (async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {

  
    const expected = process.env.SERVICE_GUEST_TOKEN?.trim();
    const body = bodySchema.parse(httpReq.body);
    if (expected && body.token !== expected) {
      return sendJson(httpRes, { error: 'Invalid token' }, 401);
    }

    const roomId = body.roomNumber ? await findRoomIdByNumber(body.roomNumber) : undefined;

    const row = await createServiceRequest({
      title: body.title,
      description: body.description,
      source: 'GUEST',
      roomId,
      location: body.roomNumber ? `Room ${body.roomNumber}` : undefined,
      reportedBy: 'guest-portal',
      category: 'guest_request',
      priority: 'NORMAL',
    });
    return sendJson(httpRes, { ok: true, id: row.id }, 201);
  
        });
      })();
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
