/** Lifted from era-hotel-pms/nest/generated/banquets__id_lines.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { addEventOrderLine, deleteEventOrderLine, listEventOrderLines } from '@/lib/services/event-order.service';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { requireHotelModule } from '@/lib/hotel-module-gate';
import { assertActiveHotelLookupCode } from '@/lib/services/master-data.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const createSchema = z.object({
  kind: z.string().trim().min(1).max(40).optional(),
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  revenueCodeId: z.string().uuid().optional(),
  notes: z.string().optional(),
});


@Controller()
export class BanquetsIdLinesController {
  @Get("api/banquets/:id/lines")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.BANQUETS_READ);
    await requireHotelModule('hotel_banquets', session.organizationId);
    const { id } = httpReq.params;
    return sendJson(httpRes, serialize(await listEventOrderLines(id)));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Post("api/banquets/:id/lines")
  @HttpCode(200)
  async post_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.BANQUETS_WRITE);
    await requireHotelModule('hotel_banquets', session.organizationId);
    const { id } = httpReq.params;
    const body = createSchema.parse(httpReq.body);
    if (body.kind) await assertActiveHotelLookupCode('EVENT_LINE_KIND', body.kind);
    return sendJson(httpRes, serialize(await addEventOrderLine({ ...body, banquetEventId: id })), 201);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Delete("api/banquets/:id/lines")
  @HttpCode(200)
  async delete_2(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.BANQUETS_WRITE);
    await requireHotelModule('hotel_banquets', session.organizationId);
    const url = requestUrl;
    const lineId = url.searchParams.get('lineId');
    if (!lineId) throw new Error('lineId query param required');
    await deleteEventOrderLine(lineId);
    return sendJson(httpRes, { deleted: true });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
