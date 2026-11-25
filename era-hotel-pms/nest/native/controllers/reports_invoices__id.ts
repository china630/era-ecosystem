/** Lifted from era-hotel-pms/nest/generated/reports_invoices__id.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { setInvoiceIntegrateFlag } from '@/lib/services/invoice-report.service';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const patchSchema = z.object({
  integrateToAccounting: z.boolean(),
});


@Controller()
export class ReportsInvoicesIdController {
  @Patch("api/reports/invoices/:id")
  @HttpCode(200)
  async patch_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.FOLIO_PAYMENT);
    const { id } = httpReq.params;
    const body = patchSchema.parse(httpReq.body);
    const updated = await setInvoiceIntegrateFlag(id, body.integrateToAccounting);
    return sendJson(httpRes, serialize(updated));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
