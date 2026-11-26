/** Lifted from era-hotel-pms/nest/generated/front-cash_unsettled-departures.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { listUnsettledDepartures } from '@/lib/services/unsettled-departures.service';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const querySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  status: z.enum(['PENDING', 'INVOICED', 'SETTLED', 'ALL']).optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
});


@Controller()
export class FrontCashUnsettledDeparturesController {
  @Get("api/front-cash/unsettled-departures")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.FOLIO_READ);
    const url = requestUrl;
    const parsed = querySchema.parse(Object.fromEntries(url.searchParams.entries()));
    const result = await listUnsettledDepartures(parsed);
    return sendJson(httpRes, serialize(result));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
