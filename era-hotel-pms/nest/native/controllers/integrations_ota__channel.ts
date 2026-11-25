/** Lifted from era-hotel-pms/nest/generated/integrations_ota__channel.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { normalizeOtaWebhookBody, upsertOtaReservation } from '@/lib/channel/ota-ingest.service';
import { resolveChannelAdapter } from '@/lib/channel/adapters/registry';
import { logSyncError } from '@/lib/services/channel.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const bodySchema = z.object({
  event: z.string().min(1),
  externalReservationId: z.string().optional(),
  payload: z.record(z.unknown()).optional(),
});

/** OTA webhook ingest — normalized payload → idempotent reservation upsert. */


@Controller()
export class IntegrationsOtaChannelController {
  @Post("api/integrations/ota/:channel")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const web = await (async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {

  
    const { channel } = httpReq.params;
    const secret = process.env.ERA_OTA_WEBHOOK_SECRET?.trim();
    if (!secret) {
      return sendJson(httpRes, { error: 'OTA webhook secret not configured' }, 503);
    }
    const header = nestHeader(httpReq, 'x-era-ota-secret')?.trim();
    if (!header || header !== secret) {
      return sendJson(httpRes, { error: 'Unauthorized' }, 401);
    }

    const raw = bodySchema.parse(httpReq.body);
    const normalized = normalizeOtaWebhookBody(channel, raw as Record<string, unknown>);

    if (!normalized.externalReservationId) {
      throw new Error('externalReservationId is required');
    }

    const adapter = await resolveChannelAdapter();
    let result;
    try {
      result = await upsertOtaReservation(normalized);
      if (adapter.ackReservation) {
        await adapter.ackReservation(normalized.externalReservationId);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'OTA ingest failed';
      await logSyncError({
        otaReference: normalized.externalReservationId,
        errorMessage: message,
      });
      throw err;
    }

    return sendJson(httpRes, {
      accepted: true,
      channel,
      adapter: adapter.code,
      mode: adapter.code,
      ...serialize(result),
    });
  
        });
      })();
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
