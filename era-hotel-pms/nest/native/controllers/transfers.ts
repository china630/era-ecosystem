/** Lifted from era-hotel-pms/nest/generated/transfers.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { createTransferOrder, listTransferOrders, listVehicles } from '@/lib/services/transfer.service';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const bodySchema = z.object({
  reservationId: z.string().uuid(),
  direction: z.enum(['IN', 'OUT']),
  flightNo: z.string().optional(),
  pickupAt: z.string().datetime(),
  vehicleId: z.string().uuid().optional(),
  price: z.number().nonnegative(),
  notes: z.string().optional(),
});


@Controller()
export class TransfersController {
  @Get("api/transfers")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.TRANSFERS_WRITE);

    const url = requestUrl;
    const reservationId = url.searchParams.get('reservationId') ?? undefined;
    const guestId = url.searchParams.get('guestId') ?? undefined;
    const status = url.searchParams.get('status') ?? undefined;
    const direction = url.searchParams.get('direction') ?? undefined;
    const hasFlight = url.searchParams.get('hasFlight');
    const fromStr = url.searchParams.get('from');
    const toStr = url.searchParams.get('to');

    const [orders, vehicles] = await Promise.all([
      listTransferOrders({
        reservationId,
        guestId,
        status,
        direction,
        hasFlight: hasFlight === '1' || hasFlight === 'true',
        from: fromStr ? new Date(fromStr) : undefined,
        to: toStr ? new Date(toStr) : undefined,
      }),
      listVehicles(),
    ]);

    return sendJson(httpRes, serialize({ orders, vehicles }));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Post("api/transfers")
  @HttpCode(200)
  async post_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.TRANSFERS_WRITE);
    const body = bodySchema.parse(httpReq.body);
    const created = await createTransferOrder({
      ...body,
      pickupAt: new Date(body.pickupAt),
    });
    return sendJson(httpRes, serialize(created));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
