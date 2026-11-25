/** Lifted from era-hotel-pms/nest/generated/procedures_appointments__id.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { finishAppointment, markNoShow } from '@/lib/services/procedure-schedule.service';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const finishSchema = z.object({
  action: z.enum(['finish', 'no_show']),
  auditNote: z.string().optional(),
});


@Controller()
export class ProceduresAppointmentsIdController {
  @Patch("api/procedures/appointments/:id")
  @HttpCode(200)
  async patch_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.MEDICAL_MANAGE);
    const { id } = httpReq.params;
    const body = finishSchema.parse(httpReq.body);

    const result =
      body.action === 'finish'
        ? await finishAppointment(id, body.auditNote)
        : { appointment: await markNoShow(id), includedInPackage: false, folioChargeId: null };

    return sendJson(httpRes, serialize(result));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
