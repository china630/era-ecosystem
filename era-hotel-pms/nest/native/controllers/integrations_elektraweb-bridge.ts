/** Lifted from era-hotel-pms/nest/generated/integrations_elektraweb-bridge.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { authenticateBridgeRequest } from '@/lib/integration/elektraweb-bridge/auth';
import { bridgeEnvelopeSchema, ingestElektrawebBridgeEnvelope } from '@/lib/integration/elektraweb-bridge/ingest';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const batchSchema = z.object({
  items: z.array(bridgeEnvelopeSchema).min(1).max(20),
});


@Controller()
export class IntegrationsElektrawebBridgeController {
  @Post("api/integrations/elektraweb-bridge")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const web = await (async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {

  try {
    const auth = await authenticateBridgeRequest({ headers: { get: (name: string) => nestHeader(httpReq, name) }, url: new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1").toString() });
    const json = httpReq.body;

    if (json && typeof json === 'object' && Array.isArray((json as { items?: unknown }).items)) {
      const { items } = batchSchema.parse(json);
      // Guests → reservations → folio within each item's entity, but across batch sort by entity
      const order = { guest: 0, reservation: 1, folio: 2, unknown: 3 } as const;
      const sorted = [...items].sort((a, b) => {
        const ea = a.entityHint ?? 'unknown';
        const eb = b.entityHint ?? 'unknown';
        return order[ea] - order[eb];
      });
      const results = [];
      for (const item of sorted) {
        results.push(await ingestElektrawebBridgeEnvelope(auth, item));
      }
      return sendJson(httpRes, {
        organizationId: auth.organizationId,
        elektrawebHotelId: auth.elektrawebHotelId,
        results,
      });
    }

    const envelope = bridgeEnvelopeSchema.parse(json);
    const summary = await ingestElektrawebBridgeEnvelope(auth, envelope);
    return sendJson(httpRes, summary);
  } catch (err) {
    if (err instanceof Error && err.message.includes('HOTELID mismatch')) {
      return sendJson(httpRes, { error: err.message }, 409);
    }
    return sendRouteError(httpRes, err);
  }

        });
      })();
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
