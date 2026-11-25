/** Lifted from era-hotel-pms/nest/generated/admin_contracts__id_allotments.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { deleteContractAllotment, listContractAllotments, upsertContractAllotment } from '@/lib/services/contract-allotment.service';
import { assertMasterDataRead, assertMasterDataWrite } from '@/lib/auth/master-data-guard';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { requireHotelModule } from '@/lib/hotel-module-gate';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  roomTypeId: z.string().uuid(),
  validFrom: z.coerce.date(),
  validTo: z.coerce.date(),
  nightlyQuota: z.number().int().positive(),
  releaseDays: z.number().int().nonnegative().optional(),
});


@Controller()
export class AdminContractsIdAllotmentsController {
  @Get("api/admin/contracts/:id/allotments")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertMasterDataRead(session, PERMISSIONS.ALLOTMENT_ADMIN);
    await requireHotelModule('hotel_distribution', session.organizationId);
    const { id } = httpReq.params;
    return sendJson(httpRes, serialize(await listContractAllotments(id)));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Post("api/admin/contracts/:id/allotments")
  @HttpCode(200)
  async post_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertMasterDataWrite(session, PERMISSIONS.ALLOTMENT_ADMIN);
    await requireHotelModule('hotel_distribution', session.organizationId);
    const { id } = httpReq.params;
    const body = upsertSchema.parse(httpReq.body);
    const row = await upsertContractAllotment({ ...body, salesContractId: id });
    return sendJson(httpRes, serialize(row), 201);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Delete("api/admin/contracts/:id/allotments")
  @HttpCode(200)
  async delete_2(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertMasterDataWrite(session, PERMISSIONS.ALLOTMENT_ADMIN);
    await requireHotelModule('hotel_distribution', session.organizationId);
    const url = requestUrl;
    const allotmentId = url.searchParams.get('allotmentId');
    if (!allotmentId) throw new Error('allotmentId query param required');
    await deleteContractAllotment(allotmentId);
    return sendJson(httpRes, { deleted: true });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
