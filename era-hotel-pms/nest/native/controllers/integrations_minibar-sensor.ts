/** Lifted from era-hotel-pms/nest/generated/integrations_minibar-sensor.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { ingestMinibarSensorEvent } from '@/lib/services/minibar-iot.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const schema = z.object({
  roomNumber: z.string().min(1),
  sensorId: z.string().optional(),
  itemCode: z.string().min(1),
  deltaQty: z.number().int().optional(),
  raw: z.record(z.unknown()).optional(),
});

function verifyWebhook(request: Request): boolean {
  const secret = process.env.MINIBAR_IOT_WEBHOOK_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== 'production';
  return request.headers.get('x-minibar-secret') === secret;
}


@Controller()
export class IntegrationsMinibarSensorController {
  @Post("api/integrations/minibar-sensor")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const web = await (async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {

  
    if (!verifyWebhook({ headers: { get: (name: string) => nestHeader(httpReq, name) }, url: new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1").toString() })) {
      return sendJson(httpRes, { error: 'Unauthorized' }, 401);
    }
    const body = schema.parse(httpReq.body);
    return sendJson(httpRes, serialize(await ingestMinibarSensorEvent(body)), 201);
  
        });
      })();
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
