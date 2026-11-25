/** Lifted from era-hotel-pms/nest/generated/fleet_vehicles.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { requireHotelModule } from '@/lib/hotel-module-gate';
import { createFleetVehicle, listFleetVehicles } from '@/lib/services/fleet.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const bodySchema = z.object({
  code: z.string().min(1),
  brand: z.string().min(1),
  licensePlate: z.string().min(1),
  driverName: z.string().optional(),
  driverPhone: z.string().optional(),
  maxSeats: z.number().int().positive(),
});


@Controller()
export class FleetVehiclesController {
  @Get("api/fleet/vehicles")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.FLEET_WRITE);
    await requireHotelModule('hotel_transfers', session.organizationId);
    return sendJson(httpRes, serialize(await listFleetVehicles()));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Post("api/fleet/vehicles")
  @HttpCode(200)
  async post_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.FLEET_WRITE);
    await requireHotelModule('hotel_transfers', session.organizationId);
    const body = bodySchema.parse(httpReq.body);
    return sendJson(httpRes, serialize(await createFleetVehicle(body)), 201);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
