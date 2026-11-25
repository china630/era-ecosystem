/** Lifted from era-hotel-pms/nest/generated/housekeeping_minibar.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { listMinibarItems, postMinibar, listMinibarOpsBoard, createMinibarCatalogItem } from '@/lib/services/wave-b-master.service';
import { toDecimal } from '@/lib/decimal';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const postSchema = z.object({
  roomId: z.string().uuid(),
  itemId: z.string().uuid(),
  qty: z.number().int().min(1).default(1),
  reservationId: z.string().uuid().optional(),
});

const itemSchema = z.object({
  code: z.string(),
  name: z.string(),
  price: z.number().positive(),
  financeSku: z.string().min(1).nullable().optional(),
});


@Controller()
export class HousekeepingMinibarController {
  @Get("api/housekeeping/minibar")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    const items = await listMinibarItems();
    const { rooms, postings } = await listMinibarOpsBoard();
    return sendJson(httpRes, serialize({ items, rooms, postings }));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Post("api/housekeeping/minibar")
  @HttpCode(200)
  async post_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    const body = httpReq.body;
    if (body.code && body.name) {
      const parsed = itemSchema.parse(body);
      const item = await createMinibarCatalogItem({
        code: parsed.code,
        name: parsed.name,
        price: toDecimal(parsed.price),
        financeSku: parsed.financeSku?.trim() || null,
      });
      return sendJson(httpRes, serialize(item));
    }
    const parsed = postSchema.parse(body);
    return sendJson(httpRes, serialize(await postMinibar(parsed)));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
