/** Lifted from era-hotel-pms/nest/generated/admin_contracts__id.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { getSalesContract, updateSalesContract, getContractUtilization } from '@/lib/services/sales-contract.service';
import { assertMasterDataRead, assertMasterDataWrite } from '@/lib/auth/master-data-guard';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { requireHotelModule } from '@/lib/hotel-module-gate';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  counterpartyType: z.enum(['AGENCY', 'CORPORATE']).optional(),
  agencyId: z.string().uuid().nullable().optional(),
  companyId: z.string().uuid().nullable().optional(),
  /** Legacy merge FK only — not a substitute for companyId. */
  companyGuestId: z.string().uuid().nullable().optional(),
  validFrom: z.coerce.date().optional(),
  validTo: z.coerce.date().nullable().optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'EXPIRED', 'CANCELLED']).optional(),
  ratePlanId: z.string().uuid().optional(),
  minStay: z.number().int().positive().nullable().optional(),
  cta: z.boolean().optional(),
  ctd: z.boolean().optional(),
  commissionPercent: z.number().min(0).max(100).nullable().optional(),
  commissionBasis: z.enum(['GROSS', 'NET']).optional(),
  depositRequired: z.boolean().optional(),
  depositAmount: z.number().nonnegative().nullable().optional(),
  notes: z.string().nullable().optional(),
  externalRef: z.string().nullable().optional(),
});


@Controller()
export class AdminContractsIdController {
  @Get("api/admin/contracts/:id")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertMasterDataRead(session, PERMISSIONS.CONTRACTS_ADMIN);
    await requireHotelModule('hotel_distribution', session.organizationId);
    const { id } = httpReq.params;
    const url = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    if (url.searchParams.get('utilization') === '1') {
      return sendJson(httpRes, serialize(await getContractUtilization(id)));
    }
    return sendJson(httpRes, serialize(await getSalesContract(id)));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Patch("api/admin/contracts/:id")
  @HttpCode(200)
  async patch_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertMasterDataWrite(session, PERMISSIONS.CONTRACTS_ADMIN);
    await requireHotelModule('hotel_distribution', session.organizationId);
    const { id } = httpReq.params;
    const body = updateSchema.parse(httpReq.body);
    const updated = await updateSalesContract(id, body);
    return sendJson(httpRes, serialize(updated));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
