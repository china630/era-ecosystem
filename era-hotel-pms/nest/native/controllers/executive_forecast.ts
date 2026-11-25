/** Lifted from era-hotel-pms/nest/generated/executive_forecast.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { assertAnyPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { getOccupancyForecast } from '@/lib/services/forecast.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const querySchema = z.object({
  days: z.coerce
    .number()
    .int()
    .optional()
    .default(14)
    .refine((d) => [7, 14, 30, 90].includes(d), {
      message: 'days must be 7, 14, 30, or 90',
    }),
});


@Controller()
export class ExecutiveForecastController {
  @Get("api/executive/forecast")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertAnyPermission(session, [
      PERMISSIONS.REPORTS_READ,
      PERMISSIONS.RESERVATIONS_READ,
    ]);
    const params = Object.fromEntries(requestUrl.searchParams);
    const { days } = querySchema.parse(params);
    return sendJson(httpRes, serialize(await getOccupancyForecast(days)));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
