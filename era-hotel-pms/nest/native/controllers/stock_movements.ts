/** Lifted from era-hotel-pms/nest/generated/stock_movements.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { postStockMovement } from '@/lib/services/stock.service';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const schema = z.object({
  productId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  type: z.enum(['RECEIPT', 'ISSUE', 'TRANSFER']),
  qty: z.number().positive(),
  reference: z.string().optional(),
});


@Controller()
export class StockMovementsController {
  @Post("api/stock/movements")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.STOCK_MANAGE);
    const body = schema.parse(httpReq.body);
    return sendJson(httpRes, serialize(await postStockMovement(body)), 201);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
