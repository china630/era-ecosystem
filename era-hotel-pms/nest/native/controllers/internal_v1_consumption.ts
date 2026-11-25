/** Lifted from era-hotel-pms/nest/generated/internal_v1_consumption.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { enterRequestTenant } from '@/lib/request-organization';
import { assertEnvServiceToken } from '@era/satellite-kit';
import { recordInternalConsumption } from '@/lib/services/internal-consumption.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const bodySchema = z.object({
  organizationId: z.string().min(1),
  businessDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sku: z.string().min(1),
  qty: z.number().finite(),
  warehouseCode: z.string().optional(),
  source: z.string().min(1).default('clinic'),
  sourceRef: z.string().min(1),
});

function unauthorized(message: string) {
  return Response.json({ error: message }, { status: 401 });
}

/** Clinic consumables for the night-audit quantity lines. Bearer SATELLITE_EVENT_SERVICE_TOKEN. */


@Controller()
export class InternalV1ConsumptionController {
  @Post("api/internal/v1/consumption")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const web = await (async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {

  try {
    const gate = assertEnvServiceToken({
      expectedEnvKeys: ['SATELLITE_EVENT_SERVICE_TOKEN'],
      authorization: nestHeader(httpReq, 'authorization'),
      xServiceToken: nestHeader(httpReq, 'x-service-token'),
    });
    if (!gate.ok) return unauthorized(gate.error);
    const body = bodySchema.parse(httpReq.body);
    enterRequestTenant(body.organizationId);
    const row = await recordInternalConsumption(body);
    return sendJson(httpRes, { id: row.id, sourceRef: row.sourceRef });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Consumption failed';
    return sendJson(httpRes, { error: message }, 400);
  }

        });
      })();
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
