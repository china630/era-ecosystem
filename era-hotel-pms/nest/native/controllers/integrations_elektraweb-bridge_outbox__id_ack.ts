/** Lifted from era-hotel-pms/nest/generated/integrations_elektraweb-bridge_outbox__id_ack.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { authenticateBridgeRequest } from "@/lib/integration/elektraweb-bridge/auth";
import { ackElektrawebOutbox } from "@/lib/integration/elektraweb-bridge/outbox.service";
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const schema = z.object({
  ok: z.boolean(),
  elektrawebLineId: z.string().optional().nullable(),
  error: z.string().optional().nullable(),
});


@Controller()
export class IntegrationsElektrawebBridgeOutboxIdAckController {
  @Post("api/integrations/elektraweb-bridge/outbox/:id/ack")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const web = await (async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {

  
    const auth = await authenticateBridgeRequest({ headers: { get: (name: string) => nestHeader(httpReq, name) }, url: new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1").toString() });
    const { id } = httpReq.params;
    const body = schema.parse(httpReq.body);
    const row = await ackElektrawebOutbox({
      organizationId: auth.organizationId,
      id,
      ok: body.ok,
      elektrawebLineId: body.elektrawebLineId,
      error: body.error,
    });
    return sendJson(httpRes, { id: row.id, status: row.status, organizationId: auth.organizationId });
  
        });
      })();
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
