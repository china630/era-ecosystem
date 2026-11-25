/** Lifted from era-hotel-pms/nest/generated/spa_slots.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { requireHotelModule } from "@/lib/hotel-module-gate";
import { createBookingSlot } from "@/integration/control-plane-platform.client";
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const bodySchema = z.object({
  resourceKey: z.string().min(1).max(64).default("spa-cabin-1"),
  resourceName: z.string().max(256).optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  capacity: z.number().int().min(1).max(32).optional(),
});


@Controller()
export class SpaSlotsController {
  @Post("api/spa/slots")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    if (!session) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    await requireHotelModule("hotel_spa_scheduling", session.organizationId);
    const body = bodySchema.parse(httpReq.body);

    const slot = await createBookingSlot(
      {
        resourceKey: body.resourceKey,
        resourceName: body.resourceName ?? `SPA ${body.resourceKey}`,
        startsAt: body.startsAt,
        endsAt: body.endsAt,
        capacity: body.capacity ?? 1,
      },
      { organizationId: session.organizationId },
    );

    return sendJson(httpRes, slot);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
