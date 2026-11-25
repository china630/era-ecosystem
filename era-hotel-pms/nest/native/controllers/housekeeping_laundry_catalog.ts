/** Lifted from era-hotel-pms/nest/generated/housekeeping_laundry_catalog.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { ensureNaftaLaundryCatalog } from '@/lib/services/hk-nafta.service';
import { createLaundryCatalogItem, findLaundryCatalogItem, listLaundryCatalogItems, updateLaundryCatalogItem } from '@/lib/services/laundry-catalog';
import { toDecimal } from '@/lib/decimal';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const priceSchema = z.number().finite().positive().nullable();

const itemBody = z.object({
  code: z.string().min(1).max(40),
  nameAz: z.string().min(1).max(120),
  nameRu: z.string().min(1).max(120),
  nameEn: z.string().min(1).max(120),
  category: z.enum(['MEN', 'WOMEN', 'CHILD']),
  washPrice: priceSchema,
  ironPrice: priceSchema,
  expressWashPrice: priceSchema,
  expressIronPrice: priceSchema,
  active: z.boolean().optional(),
});

function assertExpressPrices(data: z.infer<typeof itemBody>) {
  if (data.expressWashPrice != null && data.washPrice == null) {
    throw Object.assign(new Error('Express wash requires a regular wash price'), { status: 400 });
  }
  if (data.expressIronPrice != null && data.ironPrice == null) {
    throw Object.assign(new Error('Express iron requires a regular iron price'), { status: 400 });
  }
  if (data.washPrice == null && data.ironPrice == null) {
    throw Object.assign(new Error('At least one of wash or iron price is required'), { status: 400 });
  }
}

function priceData(data: z.infer<typeof itemBody>) {
  return {
    washPrice: data.washPrice == null ? null : toDecimal(data.washPrice),
    ironPrice: data.ironPrice == null ? null : toDecimal(data.ironPrice),
    expressWashPrice: data.expressWashPrice == null ? null : toDecimal(data.expressWashPrice),
    expressIronPrice: data.expressIronPrice == null ? null : toDecimal(data.expressIronPrice),
  };
}





const patchBody = itemBody.partial().extend({
  id: z.string().uuid(),
});


@Controller()
export class HousekeepingLaundryCatalogController {
  @Get("api/housekeeping/laundry/catalog")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    await ensureNaftaLaundryCatalog();
    const items = await listLaundryCatalogItems();
    return sendJson(httpRes, serialize({ items }));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Post("api/housekeeping/laundry/catalog")
  @HttpCode(200)
  async post_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    const data = itemBody.parse(httpReq.body);
    assertExpressPrices(data);
    const item = await createLaundryCatalogItem({
      code: data.code.trim().toUpperCase(),
      name: data.nameEn.trim(),
      nameAz: data.nameAz.trim(),
      nameRu: data.nameRu.trim(),
      nameEn: data.nameEn.trim(),
      category: data.category,
      active: data.active ?? true,
      ...priceData(data),
    });
    return sendJson(httpRes, serialize(item));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Patch("api/housekeeping/laundry/catalog")
  @HttpCode(200)
  async patch_2(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    const raw = patchBody.parse(httpReq.body);
    const existing = await findLaundryCatalogItem(raw.id);
    if (!existing) {
      return sendJson(httpRes, { error: 'Not found' }, 404);
    }
    const merged = {
      code: raw.code ?? existing.code,
      nameAz: raw.nameAz ?? existing.nameAz ?? existing.name,
      nameRu: raw.nameRu ?? existing.nameRu ?? existing.name,
      nameEn: raw.nameEn ?? existing.nameEn ?? existing.name,
      category: (raw.category ?? existing.category) as 'MEN' | 'WOMEN' | 'CHILD',
      washPrice:
        raw.washPrice !== undefined
          ? raw.washPrice
          : existing.washPrice == null
            ? null
            : Number(existing.washPrice),
      ironPrice:
        raw.ironPrice !== undefined
          ? raw.ironPrice
          : existing.ironPrice == null
            ? null
            : Number(existing.ironPrice),
      expressWashPrice:
        raw.expressWashPrice !== undefined
          ? raw.expressWashPrice
          : existing.expressWashPrice == null
            ? null
            : Number(existing.expressWashPrice),
      expressIronPrice:
        raw.expressIronPrice !== undefined
          ? raw.expressIronPrice
          : existing.expressIronPrice == null
            ? null
            : Number(existing.expressIronPrice),
      active: raw.active ?? existing.active,
    };
    assertExpressPrices(merged);
    const item = await updateLaundryCatalogItem(raw.id, {
      code: merged.code.trim().toUpperCase(),
      name: merged.nameEn.trim(),
      nameAz: merged.nameAz.trim(),
      nameRu: merged.nameRu.trim(),
      nameEn: merged.nameEn.trim(),
      category: merged.category,
      active: merged.active,
      ...priceData(merged),
    });
    return sendJson(httpRes, serialize(item));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
