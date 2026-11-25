/** Lifted from era-hotel-pms/nest/generated/concierge.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { listConciergeProducts, listConciergeOrders, bookConciergeOrder, completeConciergeOrder, createConciergeProduct } from '@/lib/services/concierge.service';
import { assertActiveHotelLookupCode } from '@/lib/services/master-data.service';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const bookSchema = z.object({
  guestId: z.string().uuid(),
  productId: z.string().uuid(),
  reservationId: z.string().uuid().optional(),
  scheduledAt: z.coerce.date().optional(),
  notes: z.string().optional(),
});

const createProductSchema = z.object({
  action: z.literal('createProduct'),
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1),
  price: z.number().nonnegative(),
  supplierName: z.string().trim().max(200).optional(),
  commissionPct: z.number().min(0).max(100).optional(),
});


@Controller()
export class ConciergeController {
  @Get("api/concierge")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.CONCIERGE_READ);
    const guestId = requestUrl.searchParams.get('guestId') ?? undefined;
    const view = requestUrl.searchParams.get('view');
    if (view === 'orders') {
      return sendJson(httpRes, serialize(await listConciergeOrders(guestId)));
    }
    return sendJson(httpRes, serialize(await listConciergeProducts()));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Post("api/concierge")
  @HttpCode(200)
  async post_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.CONCIERGE_WRITE);
    const body = httpReq.body;
    if (body.action === 'complete') {
      return sendJson(httpRes, serialize(await completeConciergeOrder(body.orderId)));
    }
    if (body.action === 'createProduct') {
      const { action: _action, ...input } = createProductSchema.parse(body);
      await assertActiveHotelLookupCode('CONCIERGE_CATEGORY', input.category);
      return sendJson(httpRes, 
        serialize(
          await createConciergeProduct({
            ...input,
            code: input.code.toUpperCase(),
            supplierName: input.supplierName || undefined,
          }),
        ),
        201,
      );
    }
    return sendJson(httpRes, serialize(await bookConciergeOrder(bookSchema.parse(body))), 201);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
