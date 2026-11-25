/** Lifted from era-hotel-pms/nest/generated/banquets__id_staff.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { deleteEventStaffAssignment, listEventStaffAssignments, upsertEventStaffAssignment } from '@/lib/services/event-order.service';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { requireHotelModule } from '@/lib/hotel-module-gate';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  role: z.string().min(1),
  staffName: z.string().min(1),
  shiftStart: z.coerce.date().optional(),
  shiftEnd: z.coerce.date().optional(),
  status: z.enum(['PLANNED', 'DONE', 'CANCELLED']).optional(),
  notes: z.string().optional(),
});


@Controller()
export class BanquetsIdStaffController {
  @Get("api/banquets/:id/staff")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.BANQUETS_READ);
    await requireHotelModule('hotel_banquets', session.organizationId);
    const { id } = httpReq.params;
    return sendJson(httpRes, serialize(await listEventStaffAssignments(id)));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Post("api/banquets/:id/staff")
  @HttpCode(200)
  async post_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.BANQUETS_WRITE);
    await requireHotelModule('hotel_banquets', session.organizationId);
    const { id } = httpReq.params;
    const body = upsertSchema.parse(httpReq.body);
    return sendJson(httpRes, serialize(await upsertEventStaffAssignment({ ...body, banquetEventId: id })), 201);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Delete("api/banquets/:id/staff")
  @HttpCode(200)
  async delete_2(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.BANQUETS_WRITE);
    await requireHotelModule('hotel_banquets', session.organizationId);
    const url = requestUrl;
    const assignmentId = url.searchParams.get('assignmentId');
    if (!assignmentId) throw new Error('assignmentId query param required');
    await deleteEventStaffAssignment(assignmentId);
    return sendJson(httpRes, { deleted: true });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
