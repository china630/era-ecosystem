/** Lifted from era-hotel-pms/nest/generated/reservation-groups__id.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { reservationPaymentMethodSchema } from '@/lib/reservation-full-patch.schema';
import { addStayToBooking, listBookingStays, updateBookingEnvelope } from '@/lib/services/booking-stays.service';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  name: z.string().nullable().optional(),
  agencyId: z.string().uuid().nullable().optional(),
  folioMode: z.enum(['INDIVIDUAL', 'MASTER', 'SPLIT']).optional(),
  allotmentBlockId: z.string().uuid().nullable().optional(),
  checkInDate: z.coerce.date().nullable().optional(),
  checkOutDate: z.coerce.date().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const addStaySchema = z.object({
  roomTypeId: z.string().uuid(),
  guestId: z.string().uuid(),
  ratePlanId: z.string().uuid(),
  mealPlanId: z.string().uuid().optional(),
  checkInDate: z.coerce.date(),
  checkOutDate: z.coerce.date(),
  paymentMethod: reservationPaymentMethodSchema,
  agencyId: z.string().uuid().optional(),
  companyId: z.string().uuid().optional(),
  salesContractId: z.string().uuid().optional(),
  sourceId: z.string().uuid().optional(),
  adults: z.number().int().positive().optional(),
});


@Controller()
export class ReservationGroupsIdController {
  @Get("api/reservation-groups/:id")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.RESERVATIONS_READ);
    const { id } = httpReq.params;
    return sendJson(httpRes, serialize(await listBookingStays(id)));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Patch("api/reservation-groups/:id")
  @HttpCode(200)
  async patch_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    const { id } = httpReq.params;
    const body = patchSchema.parse(httpReq.body);
    return sendJson(httpRes, serialize(await updateBookingEnvelope(id, body)));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Post("api/reservation-groups/:id")
  @HttpCode(200)
  async post_2(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    const { id } = httpReq.params;
    const body = addStaySchema.parse(httpReq.body);
    const stay = await addStayToBooking({
      groupId: id,
      ...body,
      paymentMethod: body.paymentMethod ?? null,
      audit: { userId: session?.sub, request: { headers: { get: (name: string) => nestHeader(httpReq, name) } } },
    });
    return sendJson(httpRes, serialize(stay), 201);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
