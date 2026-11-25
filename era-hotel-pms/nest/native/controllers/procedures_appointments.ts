/** Lifted from era-hotel-pms/nest/generated/procedures_appointments.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { createAppointment } from '@/lib/services/procedure-schedule.service';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const bodySchema = z.object({
  reservationId: z.string().uuid(),
  serviceId: z.string().uuid(),
  staffName: z.string().optional(),
  placeCode: z.string().optional(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
});


@Controller()
export class ProceduresAppointmentsController {
  @Post("api/procedures/appointments")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.MEDICAL_MANAGE);
    const body = bodySchema.parse(httpReq.body);
    const created = await createAppointment({
      ...body,
      startAt: new Date(body.startAt),
      endAt: new Date(body.endAt),
    });
    return sendJson(httpRes, serialize(created));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
