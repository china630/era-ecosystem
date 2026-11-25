/** Lifted from era-hotel-pms/nest/generated/integrations_elektraweb-bridge_outbox.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { enterSatelliteTenant } from "@era/satellite-kit";
import { authenticateBridgeRequest } from "@/lib/integration/elektraweb-bridge/auth";
import { getElektrawebBridgePolicy, isPolicyWriteEnabled } from "@/lib/integration/elektraweb-bridge/config";
import { claimPendingOutbox, enqueueElektrawebOutbox, ElektrawebOutboxError } from "@/lib/integration/elektraweb-bridge/outbox.service";
import { verifyPosBridge } from "@/lib/pos-bridge-auth";
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const enqueueSchema = z.object({
  organizationId: z.string().uuid(),
  source: z.enum(["CLINIC", "FNB"]).default("CLINIC"),
  idempotencyKey: z.string().min(4).max(120),
  patientOrigin: z.enum(["IN_HOUSE", "WALK_IN"]),
  reservationId: z.string().uuid().optional(),
  procedureCode: z.string().min(1),
  procedureName: z.string().min(1),
  amount: z.number().positive(),
  description: z.string().min(1),
});


@Controller()
export class IntegrationsElektrawebBridgeOutboxController {
  @Get("api/integrations/elektraweb-bridge/outbox")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const web = await (async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {

  
    const auth = await authenticateBridgeRequest({ headers: { get: (name: string) => nestHeader(httpReq, name) }, url: new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1").toString() });
    const policy = await getElektrawebBridgePolicy(auth.organizationId);
    const writeEnabled = isPolicyWriteEnabled(policy);
    if (!writeEnabled) {
      return sendJson(httpRes, { writeEnabled: false, organizationId: auth.organizationId, items: [] });
    }
    const claimed = await claimPendingOutbox(auth.organizationId, 5);
    return sendJson(httpRes, {
      writeEnabled: true,
      organizationId: auth.organizationId,
      items: claimed.map((row) => ({
        id: row.id,
        idempotencyKey: row.idempotencyKey,
        insert: {
          urlPath: "/Execute/SP_SPA_SAVE",
          body: row.insertPayload,
        },
      })),
    });
  
        });
      })();
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Post("api/integrations/elektraweb-bridge/outbox")
  @HttpCode(200)
  async post_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const web = await (async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {

  try {
    const body = enqueueSchema.parse(httpReq.body);
    if (!verifyPosBridge({ headers: { get: (name: string) => nestHeader(httpReq, name) }, url: new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1").toString() })) {
      const auth = await authenticateBridgeRequest({ headers: { get: (name: string) => nestHeader(httpReq, name) }, url: new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1").toString() });
      if (auth.organizationId !== body.organizationId) {
        return sendJson(httpRes, 
          { error: "organizationId does not match bridge token org" }, 403);
      }
    }
    enterSatelliteTenant({ organizationId: body.organizationId });
    const row = await enqueueElektrawebOutbox({
      organizationId: body.organizationId,
      source: body.source,
      idempotencyKey: body.idempotencyKey,
      patientOrigin: body.patientOrigin,
      reservationId: body.reservationId,
      procedureCode: body.procedureCode,
      procedureName: body.procedureName,
      amount: body.amount,
      description: body.description,
    });
    return sendJson(httpRes, 
      {
        id: row.id,
        status: row.status,
        idempotencyKey: row.idempotencyKey,
        elektrawebResNameId: row.elektrawebResNameId,
        organizationId: row.organizationId,
      },
      201,
    );
  } catch (err) {
    if (err instanceof ElektrawebOutboxError) {
      return sendRouteError(httpRes, err);
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
