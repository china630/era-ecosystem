/** Lifted from era-hotel-pms/nest/generated/admin_allotment-blocks__id.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { getAllotmentBlock, getAllotmentBlockPickup, updateAllotmentBlock } from '@/lib/services/allotment-block.service';
import { assertMasterDataRead, assertMasterDataWrite } from '@/lib/auth/master-data-guard';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { requireHotelModule } from '@/lib/hotel-module-gate';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const lineSchema = z.object({
  roomTypeId: z.string().uuid(),
  quantity: z.number().int().positive(),
  ratePlanId: z.string().uuid().optional().nullable(),
});

const patchSchema = z.object({
  name: z.string().optional(),
  status: z.enum(['TENTATIVE', 'DEFINITE', 'CANCELLED', 'RELEASED']).optional(),
  agencyId: z.string().uuid().nullable().optional(),
  salesContractId: z.string().uuid().nullable().optional(),
  validFrom: z.coerce.date().optional(),
  validTo: z.coerce.date().optional(),
  cutoffDate: z.coerce.date().nullable().optional(),
  notes: z.string().nullable().optional(),
  lines: z.array(lineSchema).min(1).optional(),
});

type Ctx = { params: Promise<{ id: string }> };


@Controller()
export class AdminAllotmentBlocksIdController {
  @Get("api/admin/allotment-blocks/:id")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertMasterDataRead(session, PERMISSIONS.ALLOTMENT_ADMIN);
    await requireHotelModule('hotel_distribution', session.organizationId);
    const { id } = httpReq.params;
    const url = requestUrl;
    if (url.searchParams.get('pickup') === '1') {
      const pickup = await getAllotmentBlockPickup(id);
      if (!pickup) return sendJson(httpRes, { error: 'Not found' }, 404);
      return sendJson(httpRes, serialize(pickup));
    }
    const row = await getAllotmentBlock(id);
    if (!row) return sendJson(httpRes, { error: 'Not found' }, 404);
    return sendJson(httpRes, serialize(row));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Patch("api/admin/allotment-blocks/:id")
  @HttpCode(200)
  async patch_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertMasterDataWrite(session, PERMISSIONS.ALLOTMENT_ADMIN);
    await requireHotelModule('hotel_distribution', session.organizationId);
    const { id } = httpReq.params;
    const body = patchSchema.parse(httpReq.body);
    const row = await updateAllotmentBlock(id, body);
    return sendJson(httpRes, serialize(row));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
