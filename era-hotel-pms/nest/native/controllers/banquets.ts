/** Lifted from era-hotel-pms/nest/generated/banquets.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { createBanquetEvent, listBanquetEvents, listBanquetMeta } from '@/lib/services/banquet.service';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const createSchema = z.object({
  eventName: z.string().min(1),
  saloonId: z.string().uuid(),
  menuPackageId: z.string().uuid().optional(),
  reservationId: z.string().uuid().optional(),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  pax: z.number().int().positive(),
  advanceAmount: z.number().nonnegative().optional(),
  contactName: z.string().optional(),
  notes: z.string().optional(),
  referenceNo: z.string().optional(),
});


@Controller()
export class BanquetsController {
  @Get("api/banquets")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.BANQUETS_READ);

    const url = requestUrl;
    const status = url.searchParams.get('status') ?? undefined;
    const fromStr = url.searchParams.get('from');
    const toStr = url.searchParams.get('to');

    const [meta, events] = await Promise.all([
      listBanquetMeta(),
      listBanquetEvents({
        status,
        from: fromStr ? new Date(fromStr) : undefined,
        to: toStr ? new Date(toStr) : undefined,
      }),
    ]);

    return sendJson(httpRes, serialize({ ...meta, events }));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Post("api/banquets")
  @HttpCode(200)
  async post_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.BANQUETS_WRITE);
    const body = createSchema.parse(httpReq.body);

    const created = await createBanquetEvent({
      ...body,
      eventDate: new Date(body.eventDate),
    });

    return sendJson(httpRes, serialize(created), 201);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
