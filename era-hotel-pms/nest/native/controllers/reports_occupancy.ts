/** Lifted from era-hotel-pms/nest/generated/reports_occupancy.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { getOccupancyGrid } from '@/lib/services/occupancy.service';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const querySchema = z.object({
  from: z.coerce.date().optional(),
  days: z.coerce.number().int().min(1).max(90).optional(),
});


@Controller()
export class ReportsOccupancyController {
  @Get("api/reports/occupancy")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.REPORTS_READ);

    const params = Object.fromEntries(requestUrl.searchParams);
    const { from, days } = querySchema.parse(params);

    return sendJson(httpRes, serialize(await getOccupancyGrid({ from, days })));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
