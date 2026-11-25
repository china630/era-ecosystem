/** Lifted from nest/generated/integrations_marketplace.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { createMarketplaceWebhookEvent } from "@/lib/marketplace-integration.service";
import { enterRetailStaff, retailNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithRetailTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const bodySchema = z.object({
  channel: z.enum(["umico", "kaspi", "other"]).default("other"),
  externalRef: z.string(),
  payload: z.record(z.unknown()).optional(),
});


@Controller()
export class IntegrationsMarketplaceController {
  @Post("api/integrations/marketplace")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterRetailStaff(httpReq, httpRes))) return;
    try {
      const session = await retailNestSession(httpReq);
      const web = await runWithRetailTenant(session, async () => {

  
    if (!(session)) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    const body = bodySchema.parse(httpReq.body);
    const secret = nestHeader(httpReq, "x-marketplace-secret");
    const expected = process.env.MARKETPLACE_WEBHOOK_SECRET ?? "marketplace-dev";
    if (secret !== expected) {
      return sendRouteError(httpRes, new Error("Unauthorized"));
    }
    const row = await createMarketplaceWebhookEvent({
      channel: body.channel,
      externalRef: body.externalRef,
      payloadJson: JSON.stringify(body.payload ?? {}),
    });
    return sendJson(httpRes, { eventId: row.id, channel: body.channel }, 201);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
