/** Lifted from nest/generated/webhooks_pms_reservation-lifecycle.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const payloadSchema = z.object({
  event: z.enum(["checked_out", "cancelled"]),
  reservationId: z.string(),
  roomNumber: z.string().optional(),
});

/** PMS → fb-pos: close open tickets linked to departed guest (doc/openapi). */


@Controller()
export class WebhooksPmsReservationLifecycleController {
  @Post("api/webhooks/pms/reservation-lifecycle")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const web = await (async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {
      

  const secret = nestHeader(httpReq, "x-fb-pos-webhook-secret");
  if (
    process.env.FB_POS_WEBHOOK_SECRET &&
    secret !== process.env.FB_POS_WEBHOOK_SECRET
  ) {
    return sendJson(httpRes, { error: "Unauthorized" }, 401);
  }

  const body = payloadSchema.parse(httpReq.body);
  return sendJson(httpRes, { received: true, ...body });

        });
      })();
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
