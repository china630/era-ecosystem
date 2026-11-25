/** Lifted from era-hotel-pms/nest/generated/integration_erp_simulate.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { applyE6FiscalStatusChanged } from '@/lib/services/fiscal-document.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const schema = z.object({
  invoiceRef: z.string().min(1),
  fiscalStatus: z.string().min(1),
  fiscalExternalId: z.string().optional(),
  rejectionReason: z.string().optional(),
});


@Controller()
export class IntegrationErpSimulateController {
  @Post("api/integration/erp/simulate")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.INTEGRATION_ADMIN);
    const body = schema.parse(httpReq.body);
    const doc = await applyE6FiscalStatusChanged({
      ...body,
      updatedAt: new Date().toISOString(),
    });
    return sendJson(httpRes, serialize({ applied: true, document: doc }));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
