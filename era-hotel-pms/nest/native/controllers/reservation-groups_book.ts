/** Lifted from era-hotel-pms/nest/generated/reservation-groups_book.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { reservationPaymentMethodSchema } from '@/lib/reservation-full-patch.schema';
import { createGroupBookingWithStays } from '@/lib/services/booking-stays.service';
import { collectStayOperationalGaps } from '@/lib/services/stay-operational-readiness.service';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const lineSchema = z.object({
  roomTypeId: z.string().uuid(),
  quantity: z.number().int().min(1).max(50),
  adults: z.number().int().min(1).max(20),
  children11_6: z.number().int().min(0).optional(),
  children5_2: z.number().int().min(0).optional(),
  children1_0: z.number().int().min(0).optional(),
  ratePlanId: z.string().uuid().optional(),
  checkInDate: z.coerce.date().optional(),
  checkOutDate: z.coerce.date().optional(),
});

const schema = z.object({
  code: z.string().min(1).max(32).optional(),
  name: z.string().trim().min(1).max(120),
  agencyId: z.string().uuid().optional(),
  walkInProfileCode: z.string().max(40).optional(),
  companyId: z.string().uuid().optional(),
  folioMode: z.enum(['INDIVIDUAL', 'MASTER', 'SPLIT']).optional(),
  checkInDate: z.coerce.date(),
  checkOutDate: z.coerce.date(),
  guestId: z.string().uuid(),
  ratePlanId: z.string().uuid(),
  mealPlanId: z.string().uuid().optional(),
  paymentMethod: reservationPaymentMethodSchema,
  sourceId: z.string().uuid().optional(),
  salesContractId: z.string().uuid().optional(),
  roomPayer: z.enum(['GUEST', 'AGENCY', 'COMPANY']).optional(),
  commissionBasis: z.enum(['GROSS', 'NET']).optional(),
  booker: z.string().optional(),
  guestRep: z.string().optional(),
  paidBy: z.string().optional(),
  contractRef: z.string().optional(),
  lines: z.array(lineSchema).min(1),
});

/** POST /api/reservation-groups/book — group envelope + N room stays. */


@Controller()
export class ReservationGroupsBookController {
  @Post("api/reservation-groups/book")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    const body = schema.parse(httpReq.body);
    if (body.checkOutDate <= body.checkInDate) {
      throw new Error('Check-out must be after check-in');
    }
    const result = await createGroupBookingWithStays({
      ...body,
      audit: { userId: session?.sub, request: { headers: { get: (name: string) => nestHeader(httpReq, name) } } },
    });
    const firstStayId = result.stays[0]?.id;
    const operationalGaps = firstStayId ? await collectStayOperationalGaps(firstStayId) : [];
    return sendJson(httpRes, serialize({ ...result, operationalGaps }), 201);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
