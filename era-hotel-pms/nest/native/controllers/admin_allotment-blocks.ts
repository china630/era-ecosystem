/** Lifted from era-hotel-pms/nest/generated/admin_allotment-blocks.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { createAllotmentBlock, listAllotmentBlocks } from '@/lib/services/allotment-block.service';
import { assertMasterDataRead, assertMasterDataWrite } from '@/lib/auth/master-data-guard';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { requireHotelModule } from '@/lib/hotel-module-gate';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const lineSchema = z.object({
  roomTypeId: z.string().uuid(),
  quantity: z.number().int().positive(),
  ratePlanId: z.string().uuid().optional().nullable(),
});

const createSchema = z.object({
  code: z.string().min(1).max(32),
  name: z.string().optional(),
  status: z.enum(['TENTATIVE', 'DEFINITE', 'CANCELLED', 'RELEASED']).optional(),
  agencyId: z.string().uuid().optional(),
  salesContractId: z.string().uuid().optional(),
  validFrom: z.coerce.date(),
  validTo: z.coerce.date(),
  cutoffDate: z.coerce.date().optional().nullable(),
  notes: z.string().optional(),
  lines: z.array(lineSchema).min(1),
});


@Controller()
export class AdminAllotmentBlocksController {
  @Get("api/admin/allotment-blocks")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertMasterDataRead(session, PERMISSIONS.ALLOTMENT_ADMIN);
    await requireHotelModule('hotel_distribution', session.organizationId);
    const url = requestUrl;
    const status = url.searchParams.get('status') as
      | 'TENTATIVE'
      | 'DEFINITE'
      | 'CANCELLED'
      | 'RELEASED'
      | null;
    const agencyId = url.searchParams.get('agencyId') ?? undefined;
    return sendJson(httpRes, 
      serialize(
        await listAllotmentBlocks({
          status: status ?? undefined,
          agencyId,
        }),
      ),
    );
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Post("api/admin/allotment-blocks")
  @HttpCode(200)
  async post_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertMasterDataWrite(session, PERMISSIONS.ALLOTMENT_ADMIN);
    await requireHotelModule('hotel_distribution', session.organizationId);
    const body = createSchema.parse(httpReq.body);
    const row = await createAllotmentBlock(body);
    return sendJson(httpRes, serialize(row), 201);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
