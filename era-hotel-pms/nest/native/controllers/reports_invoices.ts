/** Lifted from era-hotel-pms/nest/generated/reports_invoices.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { serialize } from '@/lib/serialize';
import { listInvoiceReport } from '@/lib/services/invoice-report.service';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class ReportsInvoicesController {
  @Get("api/reports/invoices")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.REPORTS_READ);
    const params = requestUrl.searchParams;
    const from = params.get('from');
    const to = params.get('to');
    const integrateOnly = params.get('integrateOnly') === '1';
    const rows = await listInvoiceReport({
      from: from ? new Date(from) : undefined,
      to: to ? new Date(`${to}T23:59:59.999Z`) : undefined,
      integrateOnly,
    });
    return sendJson(httpRes, serialize(rows));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
