/** Lifted from era-hotel-pms/nest/generated/admin_maintenance.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { assertPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { createMaintenanceWorkOrder, listMaintenanceWorkOrders } from "@/lib/services/housekeeping.service";
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const createSchema = z.object({
  roomId: z.string().nullable().optional(),
  title: z.string().min(1).max(200).default("Maintenance"),
  reportedBy: z.string().nullable().optional(),
});


@Controller()
export class AdminMaintenanceController {
  @Get("api/admin/maintenance")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    return sendJson(httpRes, await listMaintenanceWorkOrders());
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Post("api/admin/maintenance")
  @HttpCode(200)
  async post_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    const body = createSchema.parse(httpReq.body);
    const wo = await createMaintenanceWorkOrder(body);
    return sendJson(httpRes, wo, 201);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
