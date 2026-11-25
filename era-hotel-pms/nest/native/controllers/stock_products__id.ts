/** Lifted from era-hotel-pms/nest/generated/stock_products__id.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { updateProduct } from '@/lib/services/stock.service';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const schema = z.object({
  name: z.string().min(1).optional(),
  productType: z.enum(['SELLABLE', 'STOCK']).optional(),
  unit: z.string().optional(),
  price: z.number().nullable().optional(),
  currency: z.string().nullable().optional(),
  vatRate: z.number().nullable().optional(),
  active: z.boolean().optional(),
});


@Controller()
export class StockProductsIdController {
  @Patch("api/stock/products/:id")
  @HttpCode(200)
  async patch_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.STOCK_MANAGE);
    const { id } = httpReq.params;
    const body = schema.parse(httpReq.body);
    return sendJson(httpRes, serialize(await updateProduct(id, body)));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
